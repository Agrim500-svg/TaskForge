import mongoose, {Schema} from "mongoose";


const subTaskSchema = new Schema({
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200,
    },
    task: {
        type: Schema.Types.ObjectId,
        ref: "Task",
        required: true
    },
    isCompleted: {
        type: Boolean,
        default: false
    },
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    }
}, {timestamps: true})

subTaskSchema.index({ task: 1, createdAt: 1 });

export const Subtask = mongoose.model("Subtask", subTaskSchema );
