import {User} from "../models/user.models.js";
import {ProjectMember} from "../models/projectmember.models.js";
import {ApiError} from "../utils/api-error.js";
import {asyncHandler} from "../utils/async-handler.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import {Project} from "../models/project.models.js";


export const verifyJWT = asyncHandler(async (req, res, next) => {
    const authorization = req.header("Authorization");
    const token = req.cookies?.accessToken || (authorization?.startsWith("Bearer ") ? authorization.slice(7) : null);

    if(!token) {
        throw new ApiError(401, "Unauthorized request");
    }

    let decodedToken;
    try {
        decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, { algorithms: ["HS256"] });
    } catch {
        throw new ApiError(401, "Invalid or expired access token");
    }

    const user = await User.findById(decodedToken?._id).select(
        "-password -refreshToken -emailVerificationToken -emailVerificationExpiry -forgotPasswordToken -forgotPasswordExpiry",
    );
    if (!user || decodedToken.tokenVersion !== (user.tokenVersion || 0)) {
        throw new ApiError(401, "Invalid or revoked access token");
    }
    req.user = user;
    next();
});

export const validateProjectPermission = (roles = []) => {
    const allowedRoles = roles.flat(Infinity);

    return asyncHandler(async (req, res, next) => {
        const { projectId } = req.params;

        if (!projectId) {
            throw new ApiError(400, "Project ID is required");
        }
        if (!mongoose.isValidObjectId(projectId)) {
            throw new ApiError(400, "Project ID is invalid");
        }

        const projectMember = await ProjectMember.findOne({
            project: new mongoose.Types.ObjectId(projectId),
            user: new mongoose.Types.ObjectId(req.user._id),
        }).select("role project user");

        if (!projectMember) {
            const projectExists = await Project.exists({ _id: projectId });
            if (!projectExists) {
                throw new ApiError(404, "Project not found");
            }
            throw new ApiError(403, "You are not a member of this project");
        }

        if (allowedRoles.length && !allowedRoles.includes(projectMember.role)) {
            throw new ApiError(403, "You do not have permission to perform this action");
        }

        req.projectMember = projectMember;
        req.projectRole = projectMember.role;
        next();
    });
};
