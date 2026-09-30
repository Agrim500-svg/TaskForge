import { Notification } from "../models/notification.models.js";
import { ProjectMember } from "../models/projectmember.models.js";
import { UserRolesEnum } from "./constants.js";

export async function createNotifications({ recipients, actor, project, entityType, entityId, type, message, dedupePrefix }) {
  const uniqueRecipients = [...new Set((recipients ?? []).map(String))];
  if (!uniqueRecipients.length) return;
  const docs = uniqueRecipients.map((recipient) => ({
    recipient, actor: actor ?? null, project: project ?? null, entityType, entityId: entityId ?? null,
    type, message, ...(dedupePrefix ? { dedupeKey: `${dedupePrefix}:${recipient}` } : {}),
  }));
  if (!dedupePrefix) {
    await Notification.insertMany(docs);
    return;
  }
  await Notification.bulkWrite(docs.map((doc) => ({
    updateOne: {
      filter: { dedupeKey: doc.dedupeKey },
      update: { $setOnInsert: doc }, upsert: true,
    },
  })), { ordered: false });
}

export async function projectMemberIds(projectId, { exclude = [] } = {}) {
  const excluded = new Set(exclude.map(String));
  const memberships = await ProjectMember.find({ project: projectId }).select("user").lean();
  return memberships.map(({ user }) => String(user)).filter((id) => !excluded.has(id));
}

export async function projectAdminIds(projectId) {
  const memberships = await ProjectMember.find({ project: projectId, role: { $in: [UserRolesEnum.ADMIN, UserRolesEnum.PROJECT_ADMIN] } }).select("user").lean();
  return memberships.map(({ user }) => String(user));
}
