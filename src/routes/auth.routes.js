import { Router } from "express";
import {
  changeCurrentPassword,
  forgotPassword,
  getCurrentUser,
  login,
  requestEmailVerification,
  logoutUser,
  refreshAccessToken,
  registerUser,
  resendEmailVerification,
  resetForgotPassword,
  verifyEmail,
} from "../controllers/auth.controllers.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validator.middleware.js";
import { rateLimit } from "../middlewares/rate-limit.middleware.js";
import { ApiResponse } from "../utils/api-response.js";
import {
  userChangeCurrentPasswordValidator,
  userForgotPasswordValidator,
  userLoginValidator,
  userRegisterValidator,
  userResetForgotPasswordValidator,
  userRequestEmailVerificationValidator,
} from "../validators/index.js";

const router = Router();

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: "Too many sign-in attempts. Try again in 15 minutes." });
const registrationLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 5, message: "Too many account creation attempts. Try again in an hour." });
const emailLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5, message: "Too many email requests. Try again in 15 minutes." });

const publicRegistrationGate = (req, res, next) => {
  const registrationEnabled = process.env.PUBLIC_REGISTRATION_ENABLED === "true"
    || process.env.NODE_ENV !== "production";
  if (!registrationEnabled) {
    return res.status(403).json(new ApiResponse(403, {}, "Registration is currently disabled for the public demo. Please use the Demo Account to explore TaskForge."));
  }
  return next();
};

router.post("/register", publicRegistrationGate, registrationLimiter, userRegisterValidator(), validate, registerUser);
router.post("/login", loginLimiter, userLoginValidator(), validate, login);
router.get("/verify-email/:verificationToken", verifyEmail);
router.post("/request-email-verification", emailLimiter, userRequestEmailVerificationValidator(), validate, requestEmailVerification);
router.post("/refresh-token", refreshAccessToken);
router.post("/forgot-password", emailLimiter, userForgotPasswordValidator(), validate, forgotPassword);
router.post("/reset-password/:resetToken", emailLimiter, userResetForgotPasswordValidator(), validate, resetForgotPassword);

router.post("/logout", verifyJWT, logoutUser);
router.get("/current-user", verifyJWT, getCurrentUser);
router.post("/change-password", verifyJWT, userChangeCurrentPasswordValidator(), validate, changeCurrentPassword);
router.post("/resend-email-verification", emailLimiter, verifyJWT, resendEmailVerification);

export default router;

