import { Router } from "express";
import { createTask, deleteTask, getTaskById, getTasks, updateTask } from "../controllers/task.controllers.js";
import { verifyJWT, validateProjectPermission } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validator.middleware.js";
import { createTaskValidator, updateTaskValidator } from "../validators/index.js";
import { AvailableUserRole, UserRolesEnum } from "../utils/constants.js";

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

export default router;
