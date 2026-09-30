import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { getNotifications, markAllNotificationsRead, markNotificationRead } from "../controllers/notification.controllers.js";

const router = Router();
router.use(verifyJWT);
router.get("/", getNotifications);
router.patch("/read-all", markAllNotificationsRead);
router.patch("/:notificationId/read", markNotificationRead);
export default router;
