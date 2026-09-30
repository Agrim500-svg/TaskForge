# Project Management API

Base path: `/api/v1`. Successful JSON responses use `{ "statusCode", "data", "message", "success" }`. Error responses use the same envelope and include an `errors` array. The API accepts a JWT in an `Authorization: Bearer <accessToken>` header or the `accessToken` cookie unless an endpoint is explicitly public.

Project routes use the existing singular prefix `/project`.

## Authentication

| Method | URL | Authentication / role | Request body | Expected response |
| --- | --- | --- | --- | --- |
| POST | `/auth/register` | Public | `{ "email", "username", "password", "fullName?" }` | `201` account created and verification email sent; `409` duplicate email/username; `422` invalid body; `503` mail delivery failed. |
| POST | `/auth/login` | Public | `{ "email?", "username?", "password" }` | `200` user and access/refresh tokens; sets HttpOnly cookies. `401` invalid credentials; `403` email not verified. |
| POST | `/auth/logout` | Access JWT | None | `200`; clears cookies and revokes existing access/refresh tokens. |
| GET | `/auth/current-user` | Access JWT | None | `200` current user without password or token fields. |
| POST | `/auth/change-password` | Access JWT | `{ "oldPassword", "newPassword" }` | `200`; revokes tokens and clears cookies. `400` current password is incorrect; `422` invalid body. |
| POST | `/auth/refresh-token` | Refresh cookie or body token | `{ "refreshToken?" }` | `200` rotated access/refresh tokens; `401` missing, invalid, expired, or revoked token. |
| GET | `/auth/verify-email/:verificationToken` | Public | None | `200` verified; `400` invalid or expired token. |
| POST | `/auth/request-email-verification` | Public | `{ "email" }` | `200` generic response whether or not an unverified account exists; resends are limited to one per minute per account. |
| POST | `/auth/resend-email-verification` | Access JWT | None | `200` email sent; `409` already verified. |
| POST | `/auth/forgot-password` | Public | `{ "email" }` | `200` generic response whether or not the account exists. |
| POST | `/auth/reset-password/:resetToken` | Public | `{ "newPassword" }` | `200` password reset; `400` invalid/expired token; `422` invalid body. |

Email-dependent operations need the SMTP settings in `.env`. Verification and password-reset links open the frontend; set `FRONTEND_BASE_URL` to the deployed frontend origin (local default: `http://localhost:5173`). Set `MAIL_FROM` to a sender address verified by your SMTP provider before sending real mail.

## Projects and members

| Method | URL | Authentication / role | Request body | Expected response |
| --- | --- | --- | --- | --- |
| GET | `/project` | Access JWT | None | `200` projects where the user is a member, including the user's project role. |
| POST | `/project` | Access JWT | `{ "name", "description?" }` | `201`; the creator is added to the project with the Admin role. `409` duplicate project name; `422` invalid body. |
| GET | `/project/:projectId` | Project member | None | `200` project; `400` invalid ID; `403` nonmember; `404` missing project. |
| PUT | `/project/:projectId` | Admin | `{ "name", "description?" }` | `200` updated project; `403` insufficient role; `404` missing project; `422` invalid body. |
| DELETE | `/project/:projectId` | Admin | None | `200`; deletes project data and stored task attachment files. |
| GET | `/project/:projectId/members` | Project member | None | `200` member list with safe user fields. |
| POST | `/project/:projectId/members` | Admin | `{ "email", "role": "project_admin" | "member" }` | `201`; `404` user not found; `409` already a member; `422` invalid body. |
| PUT | `/project/:projectId/members/:userId` | Admin | `{ "newRole": "project_admin" | "member" }` | `200`; `400` invalid ID/role; `404` missing member; `409` operation would leave no Admin. |
| DELETE | `/project/:projectId/members/:userId` | Admin | None | `200`; `400` invalid ID; `404` missing member; `409` operation would leave no Admin. |

## Tasks and subtasks

| Method | URL | Authentication / role | Request body | Expected response |
| --- | --- | --- | --- | --- |
| GET | `/tasks/:projectId` | Project member | None | `200` project tasks. |
| POST | `/tasks/:projectId` | Admin or Project Admin | `{ "title", "description?", "assignedTo?", "status?", "dueDate?" }` | `201`; assignees must belong to the project; `400` invalid/nonmember assignee; `422` invalid body. |
| GET | `/tasks/:projectId/t/:taskId` | Project member | None | `200` task, including subtasks; `400` invalid task ID; `404` task not in project. |
| PUT | `/tasks/:projectId/t/:taskId` | Project member; managers may update task details, assigned members may update their own task status | Any of `{ "title?", "description?", "assignedTo?", "status?", "dueDate?" }` | `200`; `403` member updates a task not assigned to them or changes non-status fields; `404` task not in project; `422` invalid body/status/date. Send `assignedTo: null` or `dueDate: null` to clear those fields. |
| DELETE | `/tasks/:projectId/t/:taskId` | Admin or Project Admin | None | `200`; deletes subtasks and stored task attachment files. |
| POST | `/tasks/:projectId/t/:taskId/subtasks` | Admin or Project Admin | `{ "title" }` | `201`; `404` task not in project; `422` invalid title. |
| PUT | `/tasks/:projectId/st/:subtaskId` | Project member | `{ "status" }` (`todo`, `in_progress`, `done`) or `{ "isCompleted" }`; Admin/Project Admin may also send `{ "title?" }` | `200`; Members cannot change titles (`403`); `404` subtask not in project; `422` invalid body. |
| DELETE | `/tasks/:projectId/st/:subtaskId` | Admin or Project Admin | None | `200`; `404` subtask not in project. |

Task and subtask status values are `todo`, `in_progress`, and `done`. Task due dates use `YYYY-MM-DD`. Task and subtask IDs are always checked against the requested project.

## Task file attachments

| Method | URL | Authentication / role | Request body | Expected response |
| --- | --- | --- | --- | --- |
| POST | `/tasks/:projectId/t/:taskId/attachments` | Project member | `multipart/form-data`, repeated file field `attachments` | `201` task with appended `{ url, mimetype, size }` metadata; `400` no files/too many files; `404` task not in project; `413` file over 5 MiB; `415` disallowed MIME type, extension mismatch, or signature mismatch. |
| GET | `/images/:generatedFilename` | Public static file URL | None | File bytes served with `X-Content-Type-Options: nosniff` and same-origin resource policy. Files are generated under `public/images`; allowed types are JPEG, PNG, GIF, WebP, and PDF. |

Uploads accept at most five files per request and at most 5 MiB per file. The static URL is public to anyone who has it; do not store files that require private download authorization here.

## Project notes

| Method | URL | Authentication / role | Request body | Expected response |
| --- | --- | --- | --- | --- |
| GET | `/notes/:projectId` | Project member | None | `200` project notes, newest first. |
| POST | `/notes/:projectId` | Admin | `{ "content" }` | `201`; `403` insufficient role; `422` empty or oversized content. |
| GET | `/notes/:projectId/n/:noteId` | Project member | None | `200`; `400` invalid note ID; `404` note not in project. |
| PUT | `/notes/:projectId/n/:noteId` | Admin | `{ "content" }` | `200`; `403` insufficient role; `404` note not in project; `422` invalid content. |
| DELETE | `/notes/:projectId/n/:noteId` | Admin | None | `200`; `403` insufficient role; `404` note not in project. |

## Health and common errors

| Method | URL | Authentication / role | Request body | Expected response |
| --- | --- | --- | --- | --- |
| GET | `/healthCheck` | Public | None | `200` service health response. |

Common error codes: `400` malformed ID or request, `401` missing/invalid authentication, `403` role or membership denied, `404` resource not found in the requested scope, `409` duplicate/conflicting operation, `413` upload too large, `415` unsupported attachment, `422` validation failure, and `500` unexpected server error.

## Running the API integration tests

Set `API_TEST_MONGO_URI` to a dedicated MongoDB test connection string and run `npm run test:api`. The suite uses the `project_management_api_test` database by default (override with `API_TEST_DB_NAME`), creates uniquely named fixtures, deletes them on completion, and does not drop the database. Tests cover health/auth errors, project and member CRUD/permissions, task and subtask flows, note access controls, and attachment uploads/static delivery. Successful SMTP delivery and the associated verification/password-reset round trips require a test mail server and are not exercised by this suite.
