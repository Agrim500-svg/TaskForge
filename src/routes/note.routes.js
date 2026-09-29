import { Router } from "express";
import { createNote, deleteNote, getNoteById, getNotes, updateNote } from "../controllers/note.controllers.js";
import { verifyJWT, validateProjectPermission } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validator.middleware.js";
import { createNoteValidator, updateNoteValidator } from "../validators/index.js";
import { AvailableUserRole, UserRolesEnum } from "../utils/constants.js";

const router = Router();
router.use(verifyJWT);

router.get("/:projectId", validateProjectPermission(AvailableUserRole), getNotes);
router.post(
  "/:projectId",
  validateProjectPermission([UserRolesEnum.ADMIN]),
  createNoteValidator(),
  validate,
  createNote,
);
router.get("/:projectId/n/:noteId", validateProjectPermission(AvailableUserRole), getNoteById);
router.put(
  "/:projectId/n/:noteId",
  validateProjectPermission([UserRolesEnum.ADMIN]),
  updateNoteValidator(),
  validate,
  updateNote,
);
router.delete("/:projectId/n/:noteId", validateProjectPermission([UserRolesEnum.ADMIN]), deleteNote);

export default router;
