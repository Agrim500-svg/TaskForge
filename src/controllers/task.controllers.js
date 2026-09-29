import mongoose from "mongoose";
import { Task } from "../models/task.models.js";
import { ProjectMember } from "../models/projectmember.models.js";
import { ApiError } from "../utils/api-error.js";
import { ApiResponse } from "../utils/api-response.js";
import { asyncHandler } from "../utils/async-handler.js";

const assignedUserFields = "username fullName avatar";

const validateTaskId = (taskId) => {
  if (!mongoose.isValidObjectId(taskId)) {
    throw new ApiError(400, "Task ID is invalid");
  }
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
  return res.status(200).json(new ApiResponse(200, task, "Task fetched successfully"));
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
  const task = await Task.findOneAndDelete({
    _id: req.params.taskId,
    project: req.params.projectId,
  });
  if (!task) throw new ApiError(404, "Task not found in this project");
  return res.status(200).json(new ApiResponse(200, task, "Task deleted successfully"));
});

export { createTask, deleteTask, getTaskById, getTasks, updateTask };
