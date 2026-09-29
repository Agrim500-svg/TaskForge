import mongoose, {Schema} from "mongoose";

const projectNoteSchema = new Schema({
    project: {
        type: Schema.Types.ObjectId,
        ref: "project",
        required: true
    },
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: "project",
        required: true
    },
    content: {
        type: String,
        required: true
    }
}, {timestamps: true},
);

export const ProjectNote = mongoose.model("ProjectNote", projectNoteSchema);