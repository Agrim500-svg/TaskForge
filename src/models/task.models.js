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
    attachments: {
        type: [{
            url: String,
            mimetype: String,
            size: Number
        }],
        default: []
    }
},{timestamps: true},
);

taskSchema.index({ project: 1, createdAt: -1 });
taskSchema.index({ project: 1, status: 1 });

export const Task = mongoose.model("Task", taskSchema);
