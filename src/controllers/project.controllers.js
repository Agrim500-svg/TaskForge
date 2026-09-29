import mongoose from "mongoose";
import { User } from "../models/user.models.js";
import { Project } from "../models/project.models.js";
import { ProjectMember } from "../models/projectmember.models.js";
import { Tasks as Task } from "../models/task.models.js";
import { Subtask } from "../models/subtask.models.js";
import { ProjectNote } from "../models/note.models.js";
import { ApiResponse } from "../utils/api-response.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";
import { AvailableUserRole, UserRolesEnum } from "../utils/constants.js";

const getProject = asyncHandler(async (req, res) => {
  const projects = await ProjectMember.aggregate([
    { $match: { user: new mongoose.Types.ObjectId(req.user._id) } },
    {
      $lookup: {
        from: "projects",
        localField: "project",
        foreignField: "_id",
        as: "project",
      },
    },
    { $unwind: "$project" },
    {
      $lookup: {
        from: "projectmembers",
        localField: "project._id",
        foreignField: "project",
        as: "projectMembers",
      },
    },
    {
      $project: {
        _id: 0,
        role: 1,
        project: {
          _id: "$project._id",
          name: "$project.name",
          description: "$project.description",
          members: { $size: "$projectMembers" },
          createdAt: "$project.createdAt",
          updatedAt: "$project.updatedAt",
          createdBy: "$project.createdBy",
        },
      },
    },
  ]);

  return res.status(200).json(new ApiResponse(200, projects, "Projects fetched successfully."));
});

const getProjectById = asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.projectId);
  if (!project) throw new ApiError(404, "Project not found");
  return res.status(200).json(new ApiResponse(200, project, "Project fetched successfully."));
});

const createProject = asyncHandler(async (req, res) => {
  const { name, description } = req.body;
  let project;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      [project] = await Project.create(
        [{ name, description, createdBy: req.user._id }],
        { session },
      );
      await ProjectMember.create(
        [{ user: req.user._id, project: project._id, role: UserRolesEnum.ADMIN }],
        { session },
      );
    });
  } catch (error) {
    if (error?.code === 11000) {
      throw new ApiError(409, "A project with this name already exists");
    }
    throw error;
  } finally {
    await session.endSession();
  }

  return res.status(201).json(new ApiResponse(201, project, "Project created successfully"));
});

const updateProject = asyncHandler(async (req, res) => {
  const updates = {};
  if (req.body.name !== undefined) updates.name = req.body.name;
  if (req.body.description !== undefined) updates.description = req.body.description;

  let project;
  try {
    project = await Project.findByIdAndUpdate(
      req.params.projectId,
      { $set: updates },
      { returnDocument: "after", runValidators: true },
    );
  } catch (error) {
    if (error?.code === 11000) {
      throw new ApiError(409, "A project with this name already exists");
    }
    throw error;
  }

  if (!project) throw new ApiError(404, "Project not found");
  return res.status(200).json(new ApiResponse(200, project, "Project updated successfully"));
});

const deleteProject = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  let project;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      project = await Project.findById(projectId).session(session);
      if (!project) throw new ApiError(404, "Project not found");

      const tasks = await Task.find({ project: projectId }).select("_id").session(session).lean();
      const taskIds = tasks.map((task) => task._id);
      if (taskIds.length) {
        await Subtask.deleteMany({ task: { $in: taskIds } }, { session });
      }
      await Task.deleteMany({ project: projectId }, { session });
      await ProjectNote.deleteMany({ project: projectId }, { session });
      await ProjectMember.deleteMany({ project: projectId }, { session });
      await Project.deleteOne({ _id: projectId }, { session });
    });
  } finally {
    await session.endSession();
  }

  return res.status(200).json(new ApiResponse(200, project, "Project deleted successfully"));
});

const addMembersToProject = asyncHandler(async (req, res)=>{
    const {email, role} = req.body
    const {projectId} = req.params
    const user = await User.findOne({email})
    if(!user){
        throw new ApiError(404, "User doesnot exists")
    }

    await ProjectMember.findByIdAndUpdate(
        {
            user: new mongoose.Types.ObjectId(user._id),
            project: new mongoose.Types.ObjectId(projectId)
        },
        {
            user: new mongoose.Types.ObjectId(user._id),
            project: new mongoose.Types.ObjectId(projectId),
            role: role
        },
        {
            new: true,
            upsert: true
        }
    )

    return res
        .status(201)
        .json(new ApiResponse(201, {}, "Project member added successfully"));
});

const getProjectMembers = asyncHandler(async (req, res)=>{
    const { projectId } = req.params;
    const project = await Project.findById(req.params);

    if (!project) {
        throw new ApiError(404, "Project not found");
    }

    const projectMembers = await ProjectMember.aggregate([
    {
        $match: {
            project: new mongoose.Types.ObjectId(projectId),
        },
    },

    {
        $lookup: {
            from: "users",
            localField: "user",
            foreignField: "_id",
            as: "user",
            pipeline: [
          {
            $project: {
                _id: 1,
                 username: 1,
                fullName: 1,
                avatar: 1,
            },
          },
        ],
      },
    },
    {
        $addFields: {
            user: {
            $arrayElemAt: ["$user", 0],
            },
        },
    },
    {
        $project: {
            project: 1,
            user: 1,
            role: 1,
            createdAt: 1,
            updatedAt: 1,
            _id: 0,
        },
        },
    ]);

    return res
        .status(200)
        .json(new ApiResponse(200, projectMembers, "Project members fetched"));
});

const updateMemberRole = asyncHandler(async (req, res)=>{
    const { projectId, userId } = req.params;
    const { newRole } = req.body;

    if (!AvailableUserRole.includes(newRole)) {
        throw new ApiError(400, "Invalid Role");
    }

    let projectMember = await ProjectMember.findOne({
        project: new mongoose.Types.ObjectId(projectId),
        user: new mongoose.Types.ObjectId(userId),
    });

    if (!projectMember) {
        throw new ApiError(400, "Project member not found");
    }

    projectMember = await ProjectMember.findByIdAndUpdate(
        projectMember._id,
        {
        role: newRole,
        },
        { new: true },
    );

    if (!projectMember) {
        throw new ApiError(400, "Project member not found");
    }

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                projectMember,
                "Project member role updated successfully",
            ),
        );

});

const deleteMember = asyncHandler(async (req, res)=>{
    const { projectId, userId } = req.params;

    let projectMember = await ProjectMember.findOne({
        project: new mongoose.Types.ObjectId(projectId),
        user: new mongoose.Types.ObjectId(userId),
    });

    if (!projectMember) {
        throw new ApiError(400, "Project member not found");
    }

    projectMember = await ProjectMember.findByIdAndDelete(projectMember._id);

    if (!projectMember) {
        throw new ApiError(400, "Project member not found");
    }

    return res
        .status(200)
        .json(
            new ApiResponse(
            200,
            projectMember,
            "Project member deleted successfully",
        ),
    );

});

export{
    addMembersToProject,
    getProject,
    getProjectById,
    createProject,
    updateProject,
    deleteProject,
    getProjectMembers,
    updateMemberRole,
    deleteMember
}
