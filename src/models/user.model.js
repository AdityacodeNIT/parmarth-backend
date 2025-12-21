import mongoose, { Schema } from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import dotenv from "dotenv";
dotenv.config();

const userSchema = new Schema(
        {
                username: {
                        type: String,
                        required: [true, "UserName is Required"],
                        unique: true,
                        lowercase: true,
                        trim: true,
                        index: true,
                },
                email: {
                        type: String,
                        required: true,
                        unique: true,
                        lowercase: true,
                        trim: true,
                },
                fullName: {
                        type: String,
                        required: true,
                        trim: true,
                        index: true,
                },
                coverImage: {
                        type: String, // cloudinary
                },
                avatar: {
                        type: String,
                        
                },
                password: {
                        type: String,
                        required: [true, "Password is required"],
                },
                refreshToken: {
                        type: String,
                        trim:true,
                },
                role: {
                        type: String,
                        enum: ["customer", "seller", "admin", "superadmin"],
                        default: "customer",
                    },
                otp: {
                        type: String,
                        default: null,
                },
                otpExpiry: {
                        type: Date,
                        default: null,
                },
                isVerified: {
                        type: Boolean,
                        default: false,
                },
                // Enhanced security fields
                loginAttempts: {
                        type: Number,
                        default: 0,
                },
                lockUntil: {
                        type: Date,
                },
                emailVerified: {
                        type: Boolean,
                        default: false,
                },
                phoneVerified: {
                        type: Boolean,
                        default: false,
                },
                twoFactorEnabled: {
                        type: Boolean,
                        default: false,
                },
                twoFactorSecret: {
                        type: String,
                },
                // Analytics and tracking
                lastLogin: {
                        type: Date,
                },
                loginHistory: [{
                        timestamp: { type: Date, default: Date.now },
                        ip: String,
                        userAgent: String,
                        location: String,
                        success: { type: Boolean, default: true }
                }],
                // Account status
                isActive: {
                        type: Boolean,
                        default: true,
                },
                deactivatedAt: {
                        type: Date,
                },
                // Password security
                passwordChangedAt: {
                        type: Date,
                },
                passwordResetToken: {
                        type: String,
                },
                passwordResetExpires: {
                        type: Date,
                },
        },
        { timestamp: true },
);

userSchema.pre("save", async function (next) {
        if (!this.isModified("password")) return next();

        this.password = await bcrypt.hash(this.password, 10);
        next();
});

userSchema.methods.isPasswordCorrect = async function (password) {
        return await bcrypt.compare(password, this.password);
};

userSchema.methods.generateAccessToken = function () {
        return jwt.sign(
                {
                        _id: this._id,
                        email: this.email,
                        username: this.username,
                        
                },
                process.env.ACCESS_TOKEN_SECRET,
                {
                        expiresIn: process.env.ACCESS_TOKEN_EXPIRY,
                },
        );
};

userSchema.methods.generateRefreshToken = function () {
        return jwt.sign(
                {
                        _id: this._id,
                        email: this.email,
                },
                process.env.REFRESH_TOKEN_SECRET,
                
                {
                        expiresIn: process.env.REFRESH_TOKEN_EXPIRY,
                },
        );
};

// Virtual for account lock status
userSchema.virtual('isLocked').get(function() {
        return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Method to increment login attempts
userSchema.methods.incLoginAttempts = function() {
        // If we have a previous lock that has expired, restart at 1
        if (this.lockUntil && this.lockUntil < Date.now()) {
                return this.updateOne({
                        $unset: {
                                lockUntil: 1,
                        },
                        $set: {
                                loginAttempts: 1,
                        }
                });
        }
        
        const updates = { $inc: { loginAttempts: 1 } };
        const maxAttempts = parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5;
        const lockTime = parseInt(process.env.ACCOUNT_LOCK_DURATION) || 30 * 60 * 1000; // 30 minutes
        
        // Lock account after max attempts
        if (this.loginAttempts + 1 >= maxAttempts && !this.isLocked) {
                updates.$set = { lockUntil: Date.now() + lockTime };
        }
        
        return this.updateOne(updates);
};

// Method to reset login attempts
userSchema.methods.resetLoginAttempts = function() {
        return this.updateOne({
                $unset: {
                        loginAttempts: 1,
                        lockUntil: 1
                }
        });
};

// Method to record login
userSchema.methods.recordLogin = function(ip, userAgent, location) {
        const loginRecord = {
                timestamp: new Date(),
                ip,
                userAgent,
                location,
                success: true
        };
        
        // Keep only last 10 login records
        if (this.loginHistory.length >= 10) {
                this.loginHistory = this.loginHistory.slice(-9);
        }
        
        this.loginHistory.push(loginRecord);
        this.lastLogin = new Date();
        
        return this.save();
};

// Method to generate password reset token
userSchema.methods.createPasswordResetToken = function() {
        const resetToken = crypto.randomBytes(32).toString('hex');
        
        this.passwordResetToken = crypto
                .createHash('sha256')
                .update(resetToken)
                .digest('hex');
        
        this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
        
        return resetToken;
};

// Pre-save middleware to update passwordChangedAt
userSchema.pre('save', function(next) {
        if (!this.isModified('password') || this.isNew) return next();
        
        this.passwordChangedAt = Date.now() - 1000;
        next();
});

export const User = mongoose.model("User", userSchema);
