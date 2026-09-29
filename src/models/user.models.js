import mongoose, {Schema} from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";

const userSchema = new Schema(
    {
        avatar: {
            type: {
                url: String,
                localPath: String,
            },
            default: {
                url: `https://placehold.co/200x200`,
                localPath: ""

            }
        },
        username: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true
        },
        email: {
            type: String,
            required: true,
            unique : true,
            lowercase : true,
            trim: true
        },
        fullName: {
            type: String,
            trim: true
        },
        password: {
            type: String,
            required: [true, "Password is required"],
            select: false
        },
        isEmailVerified: {
            type: Boolean,
            default: false
        },
        tokenVersion: {
            type: Number,
            default: 0
        },
        refreshToken: {
            type: String,
            select: false
        },
        forgotPasswordToken: {
            type: String,
            select: false
        },
        forgotPasswordExpiry: {
            type: Date,
            select: false
        },
        emailVerificationToken: {
            type: String,
            select: false
        },
        emailVerificationExpiry: {
            type: Date,
            select: false
        }
    }, {
        timestamps: true,
    }
);

userSchema.pre("save", async function(){
    if(!this.isModified("password")) return;

    this.password = await bcrypt.hash(this.password, 10);
    
});

userSchema.methods.isPasswordCorrect = async function(password){
    return await bcrypt.compare(password, this.password)
};

userSchema.methods.generateAccessToken = function(){
    return jwt.sign(
        {
            _id: this._id,
            email: this.email,
            username: this.username,
            tokenVersion: this.tokenVersion || 0,
            jti: crypto.randomUUID()
        },
        process.env.ACCESS_TOKEN_SECRET,
        {expiresIn: process.env.ACCESS_TOKEN_EXPIRY}
    );
};

userSchema.methods.generateRefreshToken = function(){
    return jwt.sign(
        {
            _id: this._id,
            email: this.email,
            username: this.username,
            tokenVersion: this.tokenVersion || 0,
            jti: crypto.randomUUID()
        },
        process.env.REFRESH_TOKEN_SECRET,
        {expiresIn: process.env.REFRESH_TOKEN_EXPIRY}
    );
};

userSchema.methods.generateTemporaryToken = function() {
    const unhashedToken = crypto.randomBytes(20).toString("hex")

    const hashedToken = crypto
        .createHash("sha256")
        .update(unhashedToken)
        .digest("hex")
    
    const tokenExpiry = Date.now()+ (20*60*1000) //20min
    return {unhashedToken, hashedToken, tokenExpiry}
};

export const User = mongoose.model("User", userSchema);

