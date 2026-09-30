import { Notification } from "../models/notification.models.js";
import { Task } from "../models/task.models.js";
import { ProjectMember } from "../models/projectmember.models.js";
import { ApiError } from "../utils/api-error.js";
import { ApiResponse } from "../utils/api-response.js";
import { asyncHandler } from "../utils/async-handler.js";
import { TaskStatusEnum, UserRolesEnum } from "../utils/constants.js";
import { createNotifications } from "../utils/notifications.js";

// Evaluate due dates when the bell is fetched; the unique key prevents repeats.
const createDueSoonNotifications = async (userId) => {
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const memberships = await ProjectMember.find({ user: userId }).select("project").lean();
  if (!memberships.length) return;
  const tasks = await Task.find({ project: { $in: memberships.map(({ project }) => project) }, status: { $ne: TaskStatusEnum.DONE }, dueDate: { $gt: now, $lte: tomorrow } }).select("_id project title dueDate assignedTo").lean();
  for (const task of tasks) {
    const admins = await ProjectMember.find({ project: task.project, role: { $in: [UserRolesEnum.ADMIN, UserRolesEnum.PROJECT_ADMIN] } }).select("user").lean();
    const recipients = [...new Set([...(task.assignedTo ? [String(task.assignedTo)] : []), ...admins.map(({ user }) => String(user))])];
    if (!recipients.includes(String(userId))) continue;
    await createNotifications({ recipients: [userId], project: task.project, entityType: "task", entityId: task._id, type: "due_soon", message: `“${task.title}” is due within 24 hours.`, dedupePrefix: `due:${task._id}:${task.dueDate.toISOString().slice(0, 10)}` });
  }
};

const getNotifications = asyncHandler(async (req, res) => {
  await createDueSoonNotifications(req.user._id);
  const [items, unreadCount] = await Promise.all([
    Notification.find({ recipient: req.user._id }).sort({ createdAt: -1 }).limit(30).populate("actor", "fullName username").populate("project", "name").lean(),
    Notification.countDocuments({ recipient: req.user._id, readAt: null }),
  ]);
  return res.status(200).json(new ApiResponse(200, { items, unreadCount }, "Notifications fetched successfully"));
});

const markNotificationRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndUpdate({ _id: req.params.notificationId, recipient: req.user._id }, { $set: { readAt: new Date() } }, { returnDocument: "after" });
  if (!notification) throw new ApiError(404, "Notification not found");
  return res.status(200).json(new ApiResponse(200, notification, "Notification marked as read"));
});

const markAllNotificationsRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({ recipient: req.user._id, readAt: null }, { $set: { readAt: new Date() } });
  return res.status(200).json(new ApiResponse(200, null, "Notifications marked as read"));
});

export { getNotifications, markNotificationRead, markAllNotificationsRead };
