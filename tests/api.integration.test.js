import "dotenv/config";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { after, before, test } from "node:test";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import app from "../src/app.js";
import { Project } from "../src/models/project.models.js";
import { ProjectMember } from "../src/models/projectmember.models.js";
import { Task } from "../src/models/task.models.js";
import { Subtask } from "../src/models/subtask.models.js";
import { ProjectNote } from "../src/models/note.models.js";
import { User } from "../src/models/user.models.js";
import { removeTaskAttachments } from "../src/middlewares/multer.middleware.js";

const runId = `api_${process.pid}_${Date.now()}`;
const users = {};
const projects = [];
const tasks = [];
let server;
let baseUrl;

const tokenFor = (user, claims = {}) => jwt.sign(
  { _id: user._id, tokenVersion: user.tokenVersion ?? 0, ...claims },
  process.env.ACCESS_TOKEN_SECRET,
  Object.hasOwn(claims, "exp") ? { algorithm: "HS256" } : { algorithm: "HS256", expiresIn: "15m" },
);

const request = async (path, { user, token, method = "GET", body, form } = {}) => {
  const headers = {};
  const accessToken = token ?? (user ? tokenFor(user) : null);
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    ...(form !== undefined ? { body: form } : {}),
  });
  const contentType = response.headers.get("content-type") ?? "";
  return {
    response,
    status: response.status,
    body: contentType.includes("application/json") ? await response.json() : await response.text(),
  };
};

const makeForm = (files) => {
  const form = new FormData();
  for (const file of files) form.append("attachments", new Blob([file.bytes], { type: file.type }), file.name);
  return form;
};

before(async () => {
  if (!process.env.API_TEST_MONGO_URI) {
    throw new Error("Set API_TEST_MONGO_URI to a dedicated test MongoDB URI before running the API suite.");
  }
  if (!process.env.ACCESS_TOKEN_SECRET || !process.env.REFRESH_TOKEN_SECRET) {
    throw new Error("ACCESS_TOKEN_SECRET and REFRESH_TOKEN_SECRET must be configured for API tests.");
  }
  await mongoose.connect(process.env.API_TEST_MONGO_URI, { dbName: process.env.API_TEST_DB_NAME || "project_management_api_test" });
  await Promise.all([User.init(), Project.init(), ProjectMember.init(), Task.init(), Subtask.init(), ProjectNote.init()]);
  server = app.listen(0);
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  for (const role of ["admin", "project_admin", "member", "outsider"]) {
    users[role] = await User.create({
      username: `${runId}_${role}`,
      email: `${runId}_${role}@example.invalid`,
      password: "api-test-password",
      isEmailVerified: true,
    });
  }
  const project = await Project.create({ name: `${runId}_main`, createdBy: users.admin._id });
  const otherProject = await Project.create({ name: `${runId}_other`, createdBy: users.admin._id });
  projects.push(project, otherProject);
  await ProjectMember.insertMany([
    { user: users.admin._id, project: project._id, role: "admin" },
    { user: users.project_admin._id, project: project._id, role: "project_admin" },
    { user: users.member._id, project: project._id, role: "member" },
    { user: users.admin._id, project: otherProject._id, role: "admin" },
    { user: users.member._id, project: otherProject._id, role: "member" },
  ]);
  tasks.push(...await Task.create([
    { title: "API test task", project: project._id, assignedBy: users.admin._id },
    { title: "API test other task", project: otherProject._id, assignedBy: users.admin._id },
  ]));
});

after(async () => {
  const projectIds = projects.map((project) => project._id);
  const taskIds = tasks.map((task) => task._id);
  if (taskIds.length) {
    const persistedTasks = await Task.find({ _id: { $in: taskIds } }).select("attachments").lean();
    for (const task of persistedTasks) await removeTaskAttachments(task.attachments ?? []);
    await ProjectNote.deleteMany({ project: { $in: projectIds } });
    await Subtask.deleteMany({ task: { $in: taskIds } });
    await Task.deleteMany({ _id: { $in: taskIds } });
  }
  if (projectIds.length) {
    await ProjectMember.deleteMany({ project: { $in: projectIds } });
    await Project.deleteMany({ _id: { $in: projectIds } });
  }
  const userIds = Object.values(users).map((user) => user._id);
  if (userIds.length) await User.deleteMany({ _id: { $in: userIds } });
  if (server) await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
});

test("health and authentication error handling", async () => {
  let result = await request("/api/v1/healthCheck");
  assert.equal(result.status, 200);
  assert.equal(result.body.success, true);

  result = await request("/api/v1/auth/current-user");
  assert.equal(result.status, 401);
  result = await request("/api/v1/auth/current-user", { token: "not-a-jwt" });
  assert.equal(result.status, 401);
  result = await request("/api/v1/auth/current-user", { token: tokenFor(users.admin, { exp: Math.floor(Date.now() / 1000) - 10 }) });
  assert.equal(result.status, 401);

  result = await request("/api/v1/auth/current-user", { user: users.admin });
  assert.equal(result.status, 200);
  assert.equal(result.body.data.username, users.admin.username);
  assert.equal("password" in result.body.data, false);

  result = await request("/api/v1/auth/register", { method: "POST", body: { email: "bad", username: "UPPER", password: "x" } });
  assert.equal(result.status, 422);
  result = await request("/api/v1/auth/register", { method: "POST", body: { email: users.admin.email, username: `${runId}_duplicate`, password: "valid-password" } });
  assert.equal(result.status, 409);
  result = await request("/api/v1/auth/login", { method: "POST", body: { email: "missing@example.invalid", password: "wrong-password" } });
  assert.equal(result.status, 401);
  result = await request("/api/v1/auth/refresh-token", { method: "POST", body: {} });
  assert.equal(result.status, 401);
  result = await request("/api/v1/auth/refresh-token", { method: "POST", body: { refreshToken: "not-a-jwt" } });
  assert.equal(result.status, 401);
  result = await request("/api/v1/auth/verify-email/not-a-valid-token");
  assert.equal(result.status, 400);
  result = await request("/api/v1/auth/reset-password/not-a-valid-token", { method: "POST", body: { newPassword: "new-password" } });
  assert.equal(result.status, 400);
  result = await request("/api/v1/auth/forgot-password", { method: "POST", body: { email: "unknown@example.invalid" } });
  assert.equal(result.status, 200);
  result = await request("/api/v1/auth/change-password", { user: users.admin, method: "POST", body: { oldPassword: "wrong-password", newPassword: "new-password" } });
  assert.equal(result.status, 400);
});

test("project CRUD and membership role enforcement", async () => {
  const [project, otherProject] = projects;
  let result = await request("/api/v1/project", { user: users.admin });
  assert.equal(result.status, 200);
  assert.ok(result.body.data.some((item) => String(item.project._id) === String(project._id)));

  result = await request(`/api/v1/project/${project._id}`, { user: users.member });
  assert.equal(result.status, 200);
  result = await request("/api/v1/project/not-an-id", { user: users.admin });
  assert.equal(result.status, 400);
  result = await request(`/api/v1/project/${project._id}`, { user: users.outsider });
  assert.equal(result.status, 403);
  result = await request(`/api/v1/project/${new mongoose.Types.ObjectId()}`, { user: users.admin });
  assert.equal(result.status, 404);
  result = await request(`/api/v1/project/${project._id}`, { user: users.project_admin, method: "PUT", body: { name: "Denied" } });
  assert.equal(result.status, 403);

  result = await request("/api/v1/project", { user: users.admin, method: "POST", body: { name: `${runId}_created`, description: "created via API" } });
  assert.equal(result.status, 201);
  const createdProjectId = result.body.data._id;
  projects.push({ _id: new mongoose.Types.ObjectId(createdProjectId) });
  result = await request(`/api/v1/project/${createdProjectId}`, { user: users.admin, method: "PUT", body: { name: `${runId}_renamed`, description: "updated" } });
  assert.equal(result.status, 200);
  result = await request(`/api/v1/project/${createdProjectId}`, { user: users.admin, method: "DELETE" });
  assert.equal(result.status, 200);
  result = await request(`/api/v1/project/${project._id}/members`, { user: users.admin, method: "POST", body: { email: `missing_${runId}@example.invalid`, role: "member" } });
  assert.equal(result.status, 404);
});

test("member management endpoints and duplicate protection", async () => {
  const projectId = projects[0]._id;
  let result = await request(`/api/v1/project/${projectId}/members`, { user: users.admin });
  assert.equal(result.status, 200);
  assert.equal(result.body.data.length, 3);
  result = await request(`/api/v1/project/${projectId}/members`, { user: users.project_admin, method: "POST", body: { email: users.outsider.email, role: "member" } });
  assert.equal(result.status, 403);
  result = await request(`/api/v1/project/${projectId}/members`, { user: users.admin, method: "POST", body: { email: users.outsider.email, role: "member" } });
  assert.equal(result.status, 201);
  result = await request(`/api/v1/project/${projectId}/members`, { user: users.admin, method: "POST", body: { email: users.outsider.email, role: "member" } });
  assert.equal(result.status, 409);
  result = await request(`/api/v1/project/${projectId}/members/${users.outsider._id}`, { user: users.admin, method: "PUT", body: { newRole: "project_admin" } });
  assert.equal(result.status, 200);
  result = await request(`/api/v1/project/${projectId}/members/${users.outsider._id}`, { user: users.admin, method: "DELETE" });
  assert.equal(result.status, 200);
  result = await request(`/api/v1/project/${projectId}/members/${users.admin._id}`, { user: users.admin, method: "DELETE" });
  assert.equal(result.status, 409);
  result = await request(`/api/v1/project/${projectId}/members/not-an-id`, { user: users.admin, method: "DELETE" });
  assert.equal(result.status, 400);
});

test("task CRUD, assignment, and subtask role combinations", async () => {
  const [project, otherProject] = projects;
  let result = await request(`/api/v1/tasks/${project._id}`, { user: users.member, method: "POST", body: { title: "Denied" } });
  assert.equal(result.status, 403);
  result = await request(`/api/v1/tasks/${project._id}`, { user: users.admin, method: "POST", body: { title: "Created task", assignedTo: users.member._id, status: "todo" } });
  assert.equal(result.status, 201);
  const taskId = result.body.data._id;
  tasks.push({ _id: new mongoose.Types.ObjectId(taskId), attachments: [] });
  result = await request(`/api/v1/tasks/${project._id}`, { user: users.member });
  assert.equal(result.status, 200);
  assert.ok(result.body.data.some((task) => task._id === taskId));
  result = await request(`/api/v1/tasks/${project._id}/t/${taskId}`, { user: users.member });
  assert.equal(result.status, 200);
  result = await request(`/api/v1/tasks/${project._id}/t/${tasks[1]._id}`, { user: users.admin });
  assert.equal(result.status, 404);
  result = await request(`/api/v1/tasks/${project._id}/t/not-an-id`, { user: users.member });
  assert.equal(result.status, 400);
  result = await request(`/api/v1/tasks/${project._id}/t/${taskId}`, { user: users.project_admin, method: "PUT", body: { status: "invalid" } });
  assert.equal(result.status, 422);
  result = await request(`/api/v1/tasks/${project._id}/t/${taskId}`, { user: users.project_admin, method: "PUT", body: { title: "Updated task", status: "in_progress" } });
  assert.equal(result.status, 200);
  result = await request(`/api/v1/tasks/${project._id}`, { user: users.admin, method: "POST", body: { title: "Bad assignment", assignedTo: users.outsider._id } });
  assert.equal(result.status, 400);

  result = await request(`/api/v1/tasks/${project._id}/t/${taskId}/subtasks`, { user: users.member, method: "POST", body: { title: "Denied" } });
  assert.equal(result.status, 403);
  result = await request(`/api/v1/tasks/${project._id}/t/${taskId}/subtasks`, { user: users.project_admin, method: "POST", body: { title: "API subtask" } });
  assert.equal(result.status, 201);
  const subtaskId = result.body.data._id;
  result = await request(`/api/v1/tasks/${project._id}/st/${subtaskId}`, { user: users.member, method: "PUT", body: { isCompleted: true } });
  assert.equal(result.status, 200);
  result = await request(`/api/v1/tasks/${project._id}/st/${subtaskId}`, { user: users.member, method: "PUT", body: { title: "Denied" } });
  assert.equal(result.status, 403);
  result = await request(`/api/v1/tasks/${project._id}/st/${subtaskId}`, { user: users.project_admin, method: "PUT", body: { title: "Renamed" } });
  assert.equal(result.status, 200);
  result = await request(`/api/v1/tasks/${otherProject._id}/st/${subtaskId}`, { user: users.admin, method: "DELETE" });
  assert.equal(result.status, 404);
  result = await request(`/api/v1/tasks/${project._id}/st/${subtaskId}`, { user: users.member, method: "DELETE" });
  assert.equal(result.status, 403);
  result = await request(`/api/v1/tasks/${project._id}/st/${subtaskId}`, { user: users.admin, method: "DELETE" });
  assert.equal(result.status, 200);
  result = await request(`/api/v1/tasks/${project._id}/st/not-an-id`, { user: users.member, method: "PUT", body: { isCompleted: true } });
  assert.equal(result.status, 400);
  result = await request(`/api/v1/tasks/${project._id}/t/${taskId}`, { user: users.project_admin, method: "DELETE" });
  assert.equal(result.status, 200);
});

test("note CRUD permissions and project isolation", async () => {
  const [project, otherProject] = projects;
  let result = await request(`/api/v1/notes/${project._id}`, { user: users.admin, method: "POST", body: { content: "  API note  " } });
  assert.equal(result.status, 201);
  assert.equal(result.body.data.content, "API note");
  const noteId = result.body.data._id;
  result = await request(`/api/v1/notes/${project._id}`, { user: users.member });
  assert.equal(result.status, 200);
  result = await request(`/api/v1/notes/${project._id}/n/${noteId}`, { user: users.project_admin });
  assert.equal(result.status, 200);
  result = await request(`/api/v1/notes/${project._id}/n/${noteId}`, { user: users.member, method: "PUT", body: { content: "Denied" } });
  assert.equal(result.status, 403);
  result = await request(`/api/v1/notes/${project._id}/n/${noteId}`, { user: users.admin, method: "PUT", body: { content: "Updated note" } });
  assert.equal(result.status, 200);
  result = await request(`/api/v1/notes/${otherProject._id}/n/${noteId}`, { user: users.admin });
  assert.equal(result.status, 404);
  result = await request(`/api/v1/notes/${project._id}/n/not-an-id`, { user: users.member });
  assert.equal(result.status, 400);
  result = await request(`/api/v1/notes/${project._id}/n/${noteId}`, { user: users.member, method: "DELETE" });
  assert.equal(result.status, 403);
  result = await request(`/api/v1/notes/${project._id}/n/${noteId}`, { user: users.admin, method: "DELETE" });
  assert.equal(result.status, 200);
});

test("attachment upload validation, static delivery, and task cleanup", async () => {
  const [project] = projects;
  const targetTask = tasks[0];
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  let result = await request(`/api/v1/tasks/${project._id}/t/${targetTask._id}/attachments`, {
    user: users.project_admin,
    method: "POST",
    form: makeForm([
      { name: "../../image.png", type: "image/png", bytes: png },
      { name: "document.pdf", type: "application/pdf", bytes: Buffer.from("%PDF-1.7\n") },
    ]),
  });
  assert.equal(result.status, 201);
  const attachmentUrls = result.body.data.attachments.map((attachment) => attachment.url);
  assert.equal(attachmentUrls.length, 2);
  assert.ok(result.body.data.attachments.every((attachment) => attachment.size > 0 && attachment.mimetype));
  const staticResult = await fetch(`${baseUrl}${attachmentUrls[0]}`);
  assert.equal(staticResult.status, 200);
  assert.equal(staticResult.headers.get("x-content-type-options"), "nosniff");

  result = await request(`/api/v1/tasks/${project._id}/t/${targetTask._id}/attachments`, {
    user: users.member,
    method: "POST",
    form: makeForm([{ name: "image.png", type: "image/png", bytes: png }]),
  });
  assert.equal(result.status, 403);
  result = await request(`/api/v1/tasks/${project._id}/t/${targetTask._id}/attachments`, {
    user: users.admin,
    method: "POST",
    form: makeForm([{ name: "spoof.png", type: "image/png", bytes: Buffer.from("not a PNG") }]),
  });
  assert.equal(result.status, 415);
  result = await request(`/api/v1/tasks/${project._id}/t/${targetTask._id}/attachments`, {
    user: users.admin,
    method: "POST",
    form: makeForm([{ name: "script.html", type: "text/html", bytes: Buffer.from("<script/>") }]),
  });
  assert.equal(result.status, 415);
  result = await request(`/api/v1/tasks/${project._id}/t/${targetTask._id}/attachments`, {
    user: users.admin,
    method: "POST",
    form: makeForm([{ name: "large.pdf", type: "application/pdf", bytes: Buffer.alloc(5 * 1024 * 1024 + 1, 0x20) }]),
  });
  assert.equal(result.status, 413);
  result = await request(`/api/v1/tasks/${project._id}/t/${targetTask._id}/attachments`, {
    user: users.admin,
    method: "POST",
    form: makeForm(Array.from({ length: 6 }, (_, index) => ({ name: `${index}.png`, type: "image/png", bytes: png }))),
  });
  assert.equal(result.status, 400);

  result = await request(`/api/v1/tasks/${project._id}/t/${targetTask._id}`, { user: users.project_admin, method: "DELETE" });
  assert.equal(result.status, 200);
  assert.equal((await fetch(`${baseUrl}${attachmentUrls[0]}`)).status, 404);
});

test("logout revokes previously issued access tokens", async () => {
  const staleToken = tokenFor(users.member);
  let result = await request("/api/v1/auth/logout", { user: users.member, method: "POST" });
  assert.equal(result.status, 200);
  result = await request("/api/v1/auth/current-user", { token: staleToken });
  assert.equal(result.status, 401);
});

test("email verification, password reset, login, refresh, and password change flows", async () => {
  const verificationToken = crypto.randomBytes(32).toString("hex");
  await User.updateOne({ _id: users.outsider._id }, {
    $set: {
      emailVerificationToken: crypto.createHash("sha256").update(verificationToken).digest("hex"),
      emailVerificationExpiry: new Date(Date.now() + 60_000),
    },
  });
  let result = await request(`/api/v1/auth/verify-email/${verificationToken}`);
  assert.equal(result.status, 200);
  result = await request("/api/v1/auth/resend-email-verification", { user: users.outsider, method: "POST" });
  assert.equal(result.status, 409);

  const resetToken = crypto.randomBytes(32).toString("hex");
  await User.updateOne({ _id: users.outsider._id }, {
    $set: {
      forgotPasswordToken: crypto.createHash("sha256").update(resetToken).digest("hex"),
      forgotPasswordExpiry: new Date(Date.now() + 60_000),
    },
  });
  result = await request(`/api/v1/auth/reset-password/${resetToken}`, { method: "POST", body: { newPassword: "reset-password" } });
  assert.equal(result.status, 200);
  result = await request("/api/v1/auth/login", { method: "POST", body: { username: users.outsider.username, password: "reset-password" } });
  assert.equal(result.status, 200);

  result = await request("/api/v1/auth/login", { method: "POST", body: { email: users.admin.email, password: "api-test-password" } });
  assert.equal(result.status, 200);
  assert.match(result.response.headers.get("set-cookie"), /accessToken=/);
  const initialRefreshToken = result.body.data.refreshToken;
  result = await request("/api/v1/auth/refresh-token", { method: "POST", body: { refreshToken: initialRefreshToken } });
  assert.equal(result.status, 200);
  const refreshedAccessToken = result.body.data.accessToken;
  result = await request("/api/v1/auth/refresh-token", { method: "POST", body: { refreshToken: initialRefreshToken } });
  assert.equal(result.status, 401);
  result = await request("/api/v1/auth/change-password", {
    token: refreshedAccessToken,
    method: "POST",
    body: { oldPassword: "api-test-password", newPassword: "changed-password" },
  });
  assert.equal(result.status, 200);
  result = await request("/api/v1/auth/current-user", { token: refreshedAccessToken });
  assert.equal(result.status, 401);
  result = await request("/api/v1/auth/login", { method: "POST", body: { email: users.admin.email, password: "changed-password" } });
  assert.equal(result.status, 200);
});
