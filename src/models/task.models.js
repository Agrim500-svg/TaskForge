import mongoose, {Schema} from "mongoose";
import {AvailableTaskStatus, TaskStatusEnum} from "../utils/constants.js";


const taskSchema = new Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: String,
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
        ref: "User"
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
        defaults: []
    }
},{timestamps: true},
);

export const Tasks = mongoose.model("Task",taskSchema);