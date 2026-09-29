import { Router } from "express";
import { createTask, createSubtask, deleteTask, deleteSubtask, getTaskById, getTasks, updateTask, updateSubtask, uploadTaskAttachmentsToTask, validateTaskAttachmentTarget } from "../controllers/task.controllers.js";
import { verifyJWT, validateProjectPermission } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validator.middleware.js";
import { createTaskValidator, createSubtaskValidator, updateTaskValidator, updateSubtaskValidator } from "../validators/index.js";
import { AvailableUserRole, UserRolesEnum } from "../utils/constants.js";
import { uploadTaskAttachments } from "../middlewares/multer.middleware.js";

const router = Router();
const taskManagerRoles = [UserRolesEnum.ADMIN, UserRolesEnum.PROJECT_ADMIN];

router.use(verifyJWT);

router.get("/:projectId", validateProjectPermission(AvailableUserRole), getTasks);
router.post(
  "/:projectId",
  validateProjectPermission(taskManagerRoles),
  createTaskValidator(),
  validate,
  createTask,
);
router.get("/:projectId/t/:taskId", validateProjectPermission(AvailableUserRole), getTaskById);
router.put(
  "/:projectId/t/:taskId",
  validateProjectPermission(taskManagerRoles),
  updateTaskValidator(),
  validate,
  updateTask,
);
router.delete("/:projectId/t/:taskId", validateProjectPermission(taskManagerRoles), deleteTask);
router.post(
  "/:projectId/t/:taskId/attachments",
  validateProjectPermission(taskManagerRoles),
  validateTaskAttachmentTarget,
  uploadTaskAttachments,
  uploadTaskAttachmentsToTask,
);
router.post(
  "/:projectId/t/:taskId/subtasks",
  validateProjectPermission(taskManagerRoles),
  createSubtaskValidator(),
  validate,
  createSubtask,
);
router.put(
  "/:projectId/st/:subtaskId",
  validateProjectPermission(AvailableUserRole),
  updateSubtaskValidator(),
  validate,
  updateSubtask,
);
router.delete("/:projectId/st/:subtaskId", validateProjectPermission(taskManagerRoles), deleteSubtask);

export default router;
