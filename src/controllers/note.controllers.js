import mongoose from "mongoose";
import { ProjectNote } from "../models/note.models.js";
import { ApiError } from "../utils/api-error.js";
import { ApiResponse } from "../utils/api-response.js";
import { asyncHandler } from "../utils/async-handler.js";
import { createNotifications, projectMemberIds } from "../utils/notifications.js";

const noteCreatorFields = "username fullName avatar";

const validateNoteId = (noteId) => {
  if (!mongoose.isValidObjectId(noteId)) throw new ApiError(400, "Note ID is invalid");
};

const getNotes = asyncHandler(async (req, res) => {
  const notes = await ProjectNote.find({ project: req.params.projectId })
    .populate("createdBy", noteCreatorFields)
    .sort({ createdAt: -1 });

  return res.status(200).json(new ApiResponse(200, notes, "Project notes fetched successfully"));
});

const createNote = asyncHandler(async (req, res) => {
  const note = await ProjectNote.create({
    project: req.params.projectId,
    createdBy: req.user._id,
    content: req.body.content,
  });
  await note.populate("createdBy", noteCreatorFields);
  const project = await note.populate({ path: "project", select: "name" });
  const recipients = await projectMemberIds(req.params.projectId, { exclude: [req.user._id] });
  await createNotifications({ recipients, actor: req.user._id, project: req.params.projectId, entityType: "note", entityId: note._id, type: "note_created", message: `A new project note was added to “${project.project?.name ?? "your project"}”.` });

  return res.status(201).json(new ApiResponse(201, note, "Project note created successfully"));
});

const getNoteById = asyncHandler(async (req, res) => {
  validateNoteId(req.params.noteId);
  const note = await ProjectNote.findOne({ _id: req.params.noteId, project: req.params.projectId })
    .populate("createdBy", noteCreatorFields);
  if (!note) throw new ApiError(404, "Note not found in this project");

  return res.status(200).json(new ApiResponse(200, note, "Project note fetched successfully"));
});

const updateNote = asyncHandler(async (req, res) => {
  validateNoteId(req.params.noteId);
  const note = await ProjectNote.findOneAndUpdate(
    { _id: req.params.noteId, project: req.params.projectId },
    { $set: { content: req.body.content } },
    { returnDocument: "after", runValidators: true },
  ).populate("createdBy", noteCreatorFields);
  if (!note) throw new ApiError(404, "Note not found in this project");

  return res.status(200).json(new ApiResponse(200, note, "Project note updated successfully"));
});

const deleteNote = asyncHandler(async (req, res) => {
  validateNoteId(req.params.noteId);
  const note = await ProjectNote.findOneAndDelete({ _id: req.params.noteId, project: req.params.projectId })
    .populate("createdBy", noteCreatorFields);
  if (!note) throw new ApiError(404, "Note not found in this project");

  return res.status(200).json(new ApiResponse(200, note, "Project note deleted successfully"));
});

export { createNote, deleteNote, getNoteById, getNotes, updateNote };
