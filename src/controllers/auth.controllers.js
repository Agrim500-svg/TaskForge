import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { User } from "../models/user.models.js";
import { ApiError } from "../utils/api-error.js";
import { ApiResponse } from "../utils/api-response.js";
import { asyncHandler } from "../utils/async-handler.js";
import {
  emailVerificationMailgenContent,
  forgotPasswordMailgenContent,
  sendEmail,
} from "../utils/mail.js";

const publicUserFields = "-password -refreshToken -emailVerificationToken -emailVerificationExpiry -forgotPasswordToken -forgotPasswordExpiry";
const verificationTokenExpiry = 24 * 60 * 60 * 1000;
const passwordResetTokenExpiry = 30 * 60 * 1000;

const getCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  path: "/",
});

const frontendBaseUrl = () => (process.env.FRONTEND_BASE_URL || "http://localhost:5173").replace(/\/$/, "");
const makeVerificationUrl = (token) => `${frontendBaseUrl()}/verify-email?token=${encodeURIComponent(token)}`;
const makePasswordResetUrl = (token) => `${frontendBaseUrl()}/reset-password/${encodeURIComponent(token)}`;

const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

const createTemporaryToken = (expiresIn = passwordResetTokenExpiry) => {
  const token = crypto.randomBytes(32).toString("hex");
  return { token, hash: hashToken(token), expiresAt: new Date(Date.now() + expiresIn) };
};

const generateAccessAndRefreshTokens = async (user) => {
  try {
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });
    return { accessToken, refreshToken };
  } catch {
    throw new ApiError(500, "Could not create authentication tokens");
  }
};

const registerUser = asyncHandler(async (req, res) => {
  const { email, username, password, fullName } = req.body;
  const normalizedEmail = email.toLowerCase().trim();
  const normalizedUsername = username.toLowerCase().trim();

  const existingUser = await User.findOne({
    $or: [{ username: normalizedUsername }, { email: normalizedEmail }],
  });
  if (existingUser) {
    throw new ApiError(409, "User with this email or username already exists");
  }

  let user;
  try {
    user = await User.create({
      email: normalizedEmail,
      username: normalizedUsername,
      password,
      fullName,
      isEmailVerified: false,
    });
  } catch (error) {
    if (error?.code === 11000) {
      throw new ApiError(409, "User with this email or username already exists");
    }
    throw error;
  }

  const verification = createTemporaryToken(verificationTokenExpiry);
  user.emailVerificationToken = verification.hash;
  user.emailVerificationExpiry = verification.expiresAt;
  user.emailVerificationLastSentAt = new Date();
  await user.save({ validateBeforeSave: false });

  try {
    await sendEmail({
      email: user.email,
      subject: "Verify your TaskForge email",
      mailgenContent: emailVerificationMailgenContent(
        user.username,
        makeVerificationUrl(verification.token),
      ),
    });
  } catch {
    await User.findByIdAndDelete(user._id);
    throw new ApiError(503, "Verification email could not be sent; please try registering again");
  }

  const createdUser = await User.findById(user._id).select(publicUserFields);
  return res.status(201).json(
    new ApiResponse(201, { user: createdUser }, "Account created; verification email sent"),
  );
});

const login = asyncHandler(async (req, res) => {
  const { email, username, password } = req.body;
  const identifier = (email || username).trim().toLowerCase();
  const user = await User.findOne({
    $or: [{ email: identifier }, { username: identifier }],
  }).select("+password");

  if (!user || !(await user.isPasswordCorrect(password))) {
    throw new ApiError(401, "Invalid email/username or password");
  }
  if (!user.isEmailVerified) {
    throw new ApiError(403, "Please verify your email before logging in");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user);
  const loggedInUser = await User.findById(user._id).select(publicUserFields);
  const cookieOptions = getCookieOptions();

  return res
    .status(200)
    .cookie("accessToken", accessToken, { ...cookieOptions, maxAge: 24 * 60 * 60 * 1000 })
    .cookie("refreshToken", refreshToken, cookieOptions)
    .json(new ApiResponse(200, { user: loggedInUser, accessToken, refreshToken }, "Logged in successfully"));
});

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, {
    $inc: { tokenVersion: 1 },
    $unset: { refreshToken: 1 },
  });
  const cookieOptions = getCookieOptions();
  return res
    .status(200)
    .clearCookie("accessToken", cookieOptions)
    .clearCookie("refreshToken", cookieOptions)
    .json(new ApiResponse(200, {}, "Logged out successfully"));
});

const getCurrentUser = asyncHandler(async (req, res) =>
  res.status(200).json(new ApiResponse(200, req.user, "Current user fetched successfully")),
);

const verifyEmail = asyncHandler(async (req, res) => {
  const verificationHash = hashToken(req.params.verificationToken);
  const user = await User.findOne({
    emailVerificationToken: verificationHash,
    emailVerificationExpiry: { $gt: new Date() },
  }).select("+emailVerificationToken +emailVerificationExpiry");
  if (!user) {
    const alreadyVerified = await User.exists({ emailVerificationToken: verificationHash, isEmailVerified: true });
    if (alreadyVerified) {
      return res.status(200).json(new ApiResponse(200, { isEmailVerified: true }, "Email verified successfully"));
    }
    throw new ApiError(400, "Verification token is invalid or expired");
  }

  user.isEmailVerified = true;
  // Retain only the one-way token hash so clicking the same link again is idempotent.
  user.emailVerificationToken = verificationHash;
  user.emailVerificationExpiry = undefined;
  await user.save({ validateBeforeSave: false });

  return res.status(200).json(new ApiResponse(200, { isEmailVerified: true }, "Email verified successfully"));
});

const resendEmailVerification = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) throw new ApiError(404, "User not found");
  if (user.isEmailVerified) throw new ApiError(409, "Email is already verified");

  const verification = createTemporaryToken(verificationTokenExpiry);
  user.emailVerificationToken = verification.hash;
  user.emailVerificationExpiry = verification.expiresAt;
  user.emailVerificationLastSentAt = new Date();
  await user.save({ validateBeforeSave: false });
  await sendEmail({
    email: user.email,
    subject: "Verify your TaskForge email",
    mailgenContent: emailVerificationMailgenContent(
      user.username,
      makeVerificationUrl(verification.token),
    ),
  });

  return res.status(200).json(new ApiResponse(200, {}, "Verification email sent"));
});

const requestEmailVerification = asyncHandler(async (req, res) => {
  const email = req.body.email.toLowerCase().trim();
  const user = await User.findOne({ email }).select("+emailVerificationLastSentAt");
  const cooldownMs = 60 * 1000;
  const canSend = !user?.emailVerificationLastSentAt || Date.now() - user.emailVerificationLastSentAt.getTime() >= cooldownMs;

  if (user && !user.isEmailVerified && canSend) {
    const verification = createTemporaryToken(verificationTokenExpiry);
    user.emailVerificationToken = verification.hash;
    user.emailVerificationExpiry = verification.expiresAt;
    user.emailVerificationLastSentAt = new Date();
    await user.save({ validateBeforeSave: false });
    try {
      await sendEmail({
        email: user.email,
        subject: "Verify your TaskForge email",
        mailgenContent: emailVerificationMailgenContent(user.username, makeVerificationUrl(verification.token)),
      });
    } catch {
      // Keep this public endpoint's response neutral so it doesn't reveal registered addresses.
    }
  }

  return res.status(200).json(
    new ApiResponse(200, {}, "If that account needs verification, a new link will be sent shortly"),
  );
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
  if (!incomingRefreshToken) throw new ApiError(401, "Refresh token is required");

  let decodedToken;
  try {
    decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET, { algorithms: ["HS256"] });
  } catch {
    throw new ApiError(401, "Refresh token is invalid or expired");
  }

  const user = await User.findById(decodedToken?._id).select("+refreshToken");
  if (
    !user ||
    user.refreshToken !== incomingRefreshToken ||
    decodedToken.tokenVersion !== (user.tokenVersion || 0)
  ) {
    throw new ApiError(401, "Refresh token is invalid or expired");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user);
  const cookieOptions = getCookieOptions();
  return res
    .status(200)
    .cookie("accessToken", accessToken, { ...cookieOptions, maxAge: 24 * 60 * 60 * 1000 })
    .cookie("refreshToken", refreshToken, cookieOptions)
    .json(new ApiResponse(200, { accessToken, refreshToken }, "Tokens refreshed successfully"));
});

const forgotPassword = asyncHandler(async (req, res) => {
  const email = req.body.email.toLowerCase().trim();
  const user = await User.findOne({ email });

  // Use the same response whether or not the address is registered.
  if (user) {
    const reset = createTemporaryToken();
    user.forgotPasswordToken = reset.hash;
    user.forgotPasswordExpiry = reset.expiresAt;
    await user.save({ validateBeforeSave: false });
    await sendEmail({
      email: user.email,
      subject: "Reset your TaskForge password",
      mailgenContent: forgotPasswordMailgenContent(
        user.username,
        makePasswordResetUrl(reset.token),
      ),
    });
  }

  return res.status(200).json(new ApiResponse(200, {}, "If the account exists, a password reset email has been sent"));
});

const resetForgotPassword = asyncHandler(async (req, res) => {
  const user = await User.findOne({
    forgotPasswordToken: hashToken(req.params.resetToken),
    forgotPasswordExpiry: { $gt: new Date() },
  }).select("+forgotPasswordToken +forgotPasswordExpiry");
  if (!user) throw new ApiError(400, "Reset token is invalid or expired");

  user.password = req.body.newPassword;
  user.forgotPasswordToken = undefined;
  user.forgotPasswordExpiry = undefined;
  user.refreshToken = undefined;
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();

  return res.status(200).json(new ApiResponse(200, {}, "Password reset successfully"));
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select("+password");
  if (!user || !(await user.isPasswordCorrect(req.body.oldPassword))) {
    throw new ApiError(400, "Current password is incorrect");
  }

  user.password = req.body.newPassword;
  user.refreshToken = undefined;
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();
  const cookieOptions = getCookieOptions();
  return res
    .status(200)
    .clearCookie("accessToken", cookieOptions)
    .clearCookie("refreshToken", cookieOptions)
    .json(new ApiResponse(200, {}, "Password changed successfully; please log in again"));
});

export {
  registerUser,
  login,
  logoutUser,
  getCurrentUser,
  verifyEmail,
  resendEmailVerification,
  requestEmailVerification,
  refreshAccessToken,
  changeCurrentPassword,
  forgotPassword,
  resetForgotPassword,
};
