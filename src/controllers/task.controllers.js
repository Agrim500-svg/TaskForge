import mongoose from "mongoose";
import { Task } from "../models/task.models.js";
import { Subtask } from "../models/subtask.models.js";
import { ProjectMember } from "../models/projectmember.models.js";
import { ApiError } from "../utils/api-error.js";
import { ApiResponse } from "../utils/api-response.js";
import { asyncHandler } from "../utils/async-handler.js";
import { UserRolesEnum } from "../utils/constants.js";
import { removeTaskAttachments, removeUploadedFiles } from "../middlewares/multer.middleware.js";

const assignedUserFields = "username fullName avatar";

const validateTaskId = (taskId) => {
  if (!mongoose.isValidObjectId(taskId)) {
    throw new ApiError(400, "Task ID is invalid");
  }
};

const findTaskInProject = async (taskId, projectId) => {
  validateTaskId(taskId);
  const task = await Task.findOne({ _id: taskId, project: projectId }).select("_id");
  if (!task) throw new ApiError(404, "Task not found in this project");
  return task;
};

const findSubtaskInProject = async (subtaskId, projectId) => {
  if (!mongoose.isValidObjectId(subtaskId)) throw new ApiError(400, "Subtask ID is invalid");
  const subtask = await Subtask.findById(subtaskId);
  if (!subtask) throw new ApiError(404, "Subtask not found in this project");
  const taskExists = await Task.exists({ _id: subtask.task, project: projectId });
  if (!taskExists) throw new ApiError(404, "Subtask not found in this project");
  return subtask;
};

const validateAssignee = async (assignedTo, projectId) => {
  if (assignedTo === null || assignedTo === undefined) return assignedTo;
  if (!mongoose.isValidObjectId(assignedTo)) {
    throw new ApiError(400, "Assignee ID is invalid");
  }

  const membership = await ProjectMember.exists({ project: projectId, user: assignedTo });
  if (!membership) {
    throw new ApiError(400, "Assignee must be a member of this project");
  }
  return new mongoose.Types.ObjectId(assignedTo);
};

const getTasks = asyncHandler(async (req, res) => {
  const tasks = await Task.find({ project: req.params.projectId })
    .populate("assignedTo", assignedUserFields)
    .populate("assignedBy", assignedUserFields)
    .sort({ createdAt: -1 });

  return res.status(200).json(new ApiResponse(200, tasks, "Tasks fetched successfully"));
});

const createTask = asyncHandler(async (req, res) => {
  const { title, description, assignedTo, status } = req.body;
  const task = await Task.create({
    title,
    description,
    project: req.params.projectId,
    assignedTo: await validateAssignee(assignedTo, req.params.projectId),
    assignedBy: req.user._id,
    ...(status !== undefined ? { status } : {}),
  });
  await task.populate([
    { path: "assignedTo", select: assignedUserFields },
    { path: "assignedBy", select: assignedUserFields },
  ]);

  return res.status(201).json(new ApiResponse(201, task, "Task created successfully"));
});

const getTaskById = asyncHandler(async (req, res) => {
  validateTaskId(req.params.taskId);
  const task = await Task.findOne({
    _id: req.params.taskId,
    project: req.params.projectId,
  })
    .populate("assignedTo", assignedUserFields)
    .populate("assignedBy", assignedUserFields);

  if (!task) throw new ApiError(404, "Task not found in this project");
  const subtasks = await Subtask.find({ task: task._id })
    .populate("createdBy", assignedUserFields)
    .sort({ createdAt: 1 });
  const taskData = task.toObject();
  taskData.subtasks = subtasks;
  return res.status(200).json(new ApiResponse(200, taskData, "Task fetched successfully"));
});

const updateTask = asyncHandler(async (req, res) => {
  validateTaskId(req.params.taskId);
  const updates = {};
  for (const field of ["title", "description", "status"]) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }
  if (Object.hasOwn(req.body, "assignedTo")) {
    updates.assignedTo = await validateAssignee(req.body.assignedTo, req.params.projectId);
  }

  const task = await Task.findOneAndUpdate(
    { _id: req.params.taskId, project: req.params.projectId },
    { $set: updates },
    { returnDocument: "after", runValidators: true },
  )
    .populate("assignedTo", assignedUserFields)
    .populate("assignedBy", assignedUserFields);

  if (!task) throw new ApiError(404, "Task not found in this project");
  return res.status(200).json(new ApiResponse(200, task, "Task updated successfully"));
});

const deleteTask = asyncHandler(async (req, res) => {
  validateTaskId(req.params.taskId);
  const session = await mongoose.startSession();
  let task;
  try {
    await session.withTransaction(async () => {
      task = await Task.findOne({ _id: req.params.taskId, project: req.params.projectId }).session(session);
      if (!task) throw new ApiError(404, "Task not found in this project");
      await Subtask.deleteMany({ task: task._id }, { session });
      await task.deleteOne({ session });
    });
  } finally {
    await session.endSession();
  }
  await removeTaskAttachments(task.attachments);
  return res.status(200).json(new ApiResponse(200, task, "Task deleted successfully"));
});

const validateTaskAttachmentTarget = asyncHandler(async (req, _res, next) => {
  await findTaskInProject(req.params.taskId, req.params.projectId);
  next();
});

const uploadTaskAttachmentsToTask = asyncHandler(async (req, res) => {
  if (!req.files?.length) throw new ApiError(400, "At least one attachment is required");

  const task = await Task.findOne({ _id: req.params.taskId, project: req.params.projectId });
  if (!task) {
    await removeUploadedFiles(req.files);
    throw new ApiError(404, "Task not found in this project");
  }

  task.attachments.push(...req.files.map((file) => ({
    url: `/images/${file.filename}`,
    mimetype: file.mimetype,
    size: file.size,
  })));

  try {
    await task.save();
  } catch (error) {
    await removeUploadedFiles(req.files);
    throw error;
  }
  await task.populate([
    { path: "assignedTo", select: assignedUserFields },
    { path: "assignedBy", select: assignedUserFields },
  ]);

  return res.status(201).json(new ApiResponse(201, task, "Task attachments uploaded successfully"));
});

const createSubtask = asyncHandler(async (req, res) => {
  const task = await findTaskInProject(req.params.taskId, req.params.projectId);
  const subtask = await Subtask.create({ title: req.body.title, task: task._id, createdBy: req.user._id });
  await subtask.populate("createdBy", assignedUserFields);
  return res.status(201).json(new ApiResponse(201, subtask, "Subtask created successfully"));
});

const updateSubtask = asyncHandler(async (req, res) => {
  const subtask = await findSubtaskInProject(req.params.subtaskId, req.params.projectId);
  const isManager = [UserRolesEnum.ADMIN, UserRolesEnum.PROJECT_ADMIN].includes(req.projectRole);
  if (!isManager && Object.hasOwn(req.body, "title")) {
    throw new ApiError(403, "Members can only update subtask completion status");
  }

  if (Object.hasOwn(req.body, "title")) subtask.title = req.body.title;
  if (Object.hasOwn(req.body, "isCompleted")) subtask.isCompleted = req.body.isCompleted;
  await subtask.save();
  await subtask.populate("createdBy", assignedUserFields);
  return res.status(200).json(new ApiResponse(200, subtask, "Subtask updated successfully"));
});

const deleteSubtask = asyncHandler(async (req, res) => {
  const subtask = await findSubtaskInProject(req.params.subtaskId, req.params.projectId);
  await subtask.deleteOne();
  return res.status(200).json(new ApiResponse(200, subtask, "Subtask deleted successfully"));
});

export {
  createTask,
  createSubtask,
  deleteTask,
  deleteSubtask,
  getTaskById,
  getTasks,
  updateTask,
  updateSubtask,
  uploadTaskAttachmentsToTask,
  validateTaskAttachmentTarget,
};
