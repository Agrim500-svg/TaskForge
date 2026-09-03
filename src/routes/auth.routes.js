import {Router} from "express";
import { registerUser } from "../controllers/auth.controllers.js"
import {validate} from "../middlewares/validator.middleware.js";
import {userChangeCurrentPasswordValidator, userRegisterValidator} from "../validators/index.js";
import {login} from "../controllers/auth.controllers.js";
import {userLoginValidator, userForgotPasswordValidator, userResetForgotPasswordValidator} from "../validators/index.js";
import {verifyJWT} from "../middlewares/auth.middleware.js";
import {logoutUser, verifyEmail, refreshAccessToken, resetForgotPassword, getCurrentUser, changeCurrentPassword,  resendEmailVerification} from "../controllers/auth.controllers.js";
const router = Router();

//Unsecured Route
router.route("/register").post(userRegisterValidator(), validate, registerUser);
router.route("/login").post(userLoginValidator(), validate, login);
router.route("/verify-email/:verificationToken").get(verifyEmail);
router.route("/refresh-token").post(refreshAccessToken);
router.route("/forgot-password").post(
    userForgotPasswordValidator(),
    validate,
    resetForgotPassword
);
router.route("/reset-password/:resetToken").post(
    userResetForgotPasswordValidator(),
    validate,
    resetForgotPassword
);

//secure routes
router.route("/logout").post(verifyJWT, logoutUser);
router.route("/current-user").post(verifyJWT, getCurrentUser);
router.route("/change-password").post(verifyJWT,userChangeCurrentPasswordValidator(),validate, changeCurrentPassword);
router.route("/resend-verification-email").post(verifyJWT, resendEmailVerification);

export default router;

