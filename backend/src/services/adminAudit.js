import ActivityLog from "../models/ActivityLog.js";
import Notification from "../models/Notification.js";

export async function recordActivity({ actor, action, entityType, entityId, details = {} }) {
  return ActivityLog.create({
    actor: actor?._id ?? actor ?? null,
    action,
    entityType,
    entityId: entityId ?? null,
    details,
  });
}

export async function createNotification({
  title,
  message,
  type,
  entityType,
  entityId,
  actor,
}) {
  return Notification.create({
    title,
    message,
    type,
    entityType,
    entityId: entityId ?? null,
    actor: actor?._id ?? actor ?? null,
  });
}
