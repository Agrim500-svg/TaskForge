import mongoose, { Schema } from "mongoose";

const notificationSchema = new Schema({
  recipient: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  actor: { type: Schema.Types.ObjectId, ref: "User", default: null },
  project: { type: Schema.Types.ObjectId, ref: "Project", default: null },
  entityType: { type: String, enum: ["project", "task", "note"], required: true },
  entityId: { type: Schema.Types.ObjectId, default: null },
  type: { type: String, required: true },
  message: { type: String, required: true, maxlength: 240 },
  readAt: { type: Date, default: null },
  dedupeKey: { type: String, unique: true, sparse: true },
}, { timestamps: true });

notificationSchema.index({ recipient: 1, createdAt: -1 });
export const Notification = mongoose.model("Notification", notificationSchema);
