import {User} from "../models/user.models.js"
import {ApiResponse} from "../utils/api-Response.js"
import {ApiError} from "../utils/api-error.js"
import {asyncHandler} from "../utils/async-handler.js"
import {emailVerificationMailgenContent, sendEmail} from "../utils/mail.js"
import jwt from "jsonwebtoken"

const generateAccessAndRefreshTokens = async (userId) => {
    try{
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken
        await user.save({validateBeforeSave: false})
        return {accessToken, refreshToken}
    } catch (error) {
        throw new ApiError(
            500,
            "Something went wrong while generating token",
        );
    }
};


const registerUser = asyncHandler(async (req, res) => {
    const {email, username, password, role}=req.body

    const existedUser = await User.findOne({
        $or: [{username}, {email}]
    });

console.log("Email received:", email);
console.log("Username received:", username);
console.log("Existing user:", existedUser);


    if(existedUser){
        throw new ApiError(409, "User with email or username already exists", []);
    }

    const user = await User.create({
        email,
        password,
        username,
        isEmailVerified: false
    });

    const { unhashedToken, hashedToken, tokenExpiry }= 
        user.generateTemporaryToken();

        user.emailVerificationToken = hashedToken
        user.emailVerificationExpiry = tokenExpiry

        await user.save({validateBeforeSave: false})

        await sendEmail({
            email: user?.email,
            subject: "Please verify your email",
            mailgenContent: emailVerificationMailgenContent(
                user.username,
                `${req.protocol}://${req.get("host")}/api/v1/users/verify-email/${unhashedToken}`
            ),
        });


        const createdUser = await User.findById(user._id).select("-password -refreshToken -emailVerificationToken -emailVerificationExpiry",

        );

        if(!createdUser){
            throw new ApiError(500, "Something went wrong while registering a user")
        }

        return res
            .status(201)
            .json(
                new ApiResponse(
                    200,
                    {user: createdUser},
                    "User registered successfully and verification email has been sent on your email"
                )
            )

});


const login = asyncHandler(async (req, res) => {
    const {email,password, username} = req.body

    if(!username || !email){
        throw new ApiError(400, "Please provide username or email")
    }

    const user = await User.findOne({email});

    if(!user){
        throw new ApiError(400, "User doesnot exist")
    }

    const isPasswordValid = await user.isPasswordCorrect(password);

    if(!isPasswordValid){
        throw new ApiError(400, "Invalid credentials")
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id);
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken -emailVerificationToken -emailVerificationExpiry",

    );

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
        .status(200)
        .cookie("refreshToken", refreshToken, options)
        .cookie("accessToken", accessToken, options)
        .json(
            new ApiResponse(
                200,
                {user: loggedInUser, accessToken, refreshToken},
                "User logged in successfully"
            )
        )
});


const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: "",
            },
        },
        {
            returnDocument: "after",
        },
    );
    const options = {
        httpOnly: true,
        secure: true
    }
    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200, {}, "User logged out"));
});


const getCurrentUser = asyncHandler(async (req, res)=>{
    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                req.user,
                "Current user fetched successfully"
            )
        );
});


const verifyEmail = asyncHandler(async (req, res)=>{
    const {verificationToken} = req.params

    if(!verificationToken){
        throw new ApiError(400, "Email verification token is missing")
    }

    let hashedtoken = crypto
        .createdHash("sha256")
        .update(verificationToken)
        .digest("hex")
        
        const user=await User.findOne({
            emailVerificationToken: hashedtoken,
            emailVerificationExpiry: {$gt: Date.now()}
        })

        if(!user){
            throw new ApiError(400, "Token is invalid or expired");
        }
        user.emailVerificationToken = undefined
        user.emailVerificationExpiry = undefined

        user.isEmailVerified = true
        await user.save({validateBeforeSave: false})

        return res
            .status(200)
            .json(
                new ApiResponse(
                    200,
                {
                    isEmailVerified: true
                },
                "Email is verified",
                )
            )
});


const resendEmailVerification = asyncHandler(async (req,res)=>{
    const user = await User.findById(req.user?._id);

    if(!user){
        throw new ApiError(404, "User doesnot exist")
    }
    if(user.isEmailVerified){
        throw new ApiError(409, "Email is already verified")
    }

    const { unhashedToken, hashedToken, tokenExpiry }= 
        user.generateTemporaryToken();

        user.emailVerificationToken = hashedToken
        user.emailVerificationExpiry = tokenExpiry

        await user.save({validateBeforeSave: false})

        await sendEmail({
            email: user?.email,
            subject: "Please verify your email",
            mailgenContent: emailVerificationMailgenContent(
                user.username,
                `${req.protocol}://${req.get("host")}/api/v1/users/verify-email/${unhashedToken}`
            ),
        });

        return res
            .status(200)
            .json(
                new ApiResponse(
                    200,
                    {},
                    "Verification email has been sent on your email"
                )
            )
});


const refreshAccessToken = asyncHandler(async (req,res)=>{
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if(!incomingRefreshToken){
        throw new ApiError(401, "Unauthorized access")
    }

    try{
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)
        const user =await User.findById(decodedToken?._id);
        if(!user){
            throw new ApiError(401, "Invalid refresh token");
        }

        if(incomingRefreshToken !== user?.refreshToken){
            throw new ApiError(401, "Refresh token is expired");
        }

        const options = {
            httpOnly: true,
            secure: true
        }

        const {accessToken, refreshToken: newRefreshToken} = await generateAccessAndRefreshTokens(user._id)

        user.refreshToken = newRefreshToken;
        await user.save()

        return res
            .status(200)
            .cookie("refreshToken", newRefreshToken, options)
            .cookie("accessToken", accessToken, options)
            .json(
                new ApiResponse(
                    200,
                    {accessToken, refreshToken: newRefreshToken},
                    "Access token refreshed successfully"
                )
            )
    }catch(error){
        throw new ApiError(401, "Invalid Refresh token");
    }
});

const forgotPassword = asyncHandler(async (req,res)=>{
    const {email} = req.body

    await user.findOne({email})

    if(!user){
        throw new ApiError(404, "User doesnot exist", [])
    }
    const { unhashedToken, hashedToken, tokenExpiry } = user.generateTemporaryToken();

    user.forgotPasswordToken = hashedToken
    user.forgotPasswordExpiry = tokenExpiry

    await user.save({validateBeforeSave: false})

    await sendEmail({
            email: user?.email,
            subject: "Password Reset Request",
            mailgenContent: forgotPasswordMailgenContent(
                user.username,
                `${process.env.FORGOT_PASSWORD_REDIRECT_URL}/${unhashedToken}`,
            ),
        });

        return res
            .status(200)
            .json(
                new ApiResponse(
                    200,
                    {},
                    "Password reset email has been sent on your email"
                )
            )
});

const resetForgotPassword = asyncHandler(async (req,res)=>{
    const {resetToken} = req.params
    const {newPassword} = req.body

    let hashedToken = crypto
        .createHash("sha256")
        .update(resetToken)
        .digest("hex")

    await User.findOne({
        forgotPasswordToken: hashedToken,
        forgotPasswordExpiry: {$gt: Date.now()}
    })

    if(!user){
        throw new ApiError(400, "Token is invalid or expired");
    }

    user.forgotPasswordExpiry = undefined
    user.forgotPasswordToken = undefined
    user.password = newPassword
    await user.save({validateBeforeSave: false})

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                {},
                "Password has been reset successfully"
            )
        );
});

const changeCurrentPassword = asyncHandler(async (req,res)=>{
    const {oldPassword, newPassword} = req.body
    const user = await User.findById(req.user._id);

    const isPasswordValid = await user.isPasswordCorrect(oldPassword)

    if(!isPasswordValid){
        throw new ApiError(400, "Invalid Old Password")
    }

    user.password = newPassword
    await user.save({validateBeforeSave: false})

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                {},
                "Password has been changed successfully"
            )
        );
});

export { registerUser, login, logoutUser, getCurrentUser, verifyEmail, resendEmailVerification, refreshAccessToken, changeCurrentPassword, resetForgotPassword, forgotPassword }; 