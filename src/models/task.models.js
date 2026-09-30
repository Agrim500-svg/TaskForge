import mongoose, {Schema} from "mongoose";
import {AvailableTaskStatus, TaskStatusEnum} from "../utils/constants.js";


const taskSchema = new Schema({
    title: {
        type: String,
        required: true,
        trim: true,
        minlength: 1,
        maxlength: 200,
    },
    description: {
        type: String,
        trim: true,
        maxlength: 5000,
    },
    project: {
        type: Schema.Types.ObjectId,
        ref: "Project",
        required: true
    },
    assignedTo: {
        type: Schema.Types.ObjectId,
        ref: "User"
    },
    assignedBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    status: {
        type: String,
        enum: AvailableTaskStatus,
        default: TaskStatusEnum.TODO
    },
    dueDate: {
        type: Date,
        default: null,
    },
    attachments: {
        type: [{
            url: {
                type: String,
                required: true,
                match: /^\/images\/[0-9a-f-]{36}\.(jpg|jpeg|png|gif|webp|pdf)$/,
            },
            mimetype: {
                type: String,
                required: true,
                enum: ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"],
            },
            size: {
                type: Number,
                required: true,
                min: 1,
                max: 5 * 1024 * 1024,
            }
        }],
        default: []
    }
},{timestamps: true},
);

taskSchema.index({ project: 1, createdAt: -1 });
taskSchema.index({ project: 1, status: 1 });

export const Task = mongoose.model("Task", taskSchema);
