import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";
import { Seller } from "../models/seller.model.js";
import redis from "../utils/redisClients.js";

// ✅ Middleware to verify JWT for normal users
export const verifyJWT = asyncHandler(async (req, res, next) => {
    try {
        const token = req.cookies?.accessToken;

        if (!token) {
            throw new ApiError(401, "Access token is missing. Please log in.");
        }
    // 🔒 Check if token is blacklisted in Redis
    
        const isBlacklisted = await redis.get(`bl_${token}`);
        if (isBlacklisted) {
            throw new ApiError(401, "Token is blacklisted. Please log in again.");
        }

        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        const user = await User.findById(decodedToken._id).select("-password -refreshToken");

        if (!user) {
            throw new ApiError(401, "User not found. Invalid token.");
        }

        req.user = user;
        next();
    } catch (error) {
        console.error("JWT Middleware Error:", error.message);
        next(error);
    }
});

// ✅ Middleware to verify JWT for sellers
export const verifySeller = asyncHandler(async (req, res, next) => {
    try {
        const token = req.cookies?.accessToken;

        if (!token) {
            throw new ApiError(401, "Token is not present");
        }

        // 🔒 Check blacklist
        const isBlacklisted = await redis.get(`bl_${token}`);
        if (isBlacklisted) {
            throw new ApiError(401, "Token is blacklisted");
        }

        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        const seller = await Seller.findById(decodedToken._id).select("-password -refreshToken");

        if (!seller) {
            throw new ApiError(401, "Invalid Access Token");
        }

        req.seller = seller;
        next();
    } catch (error) {
        console.error("JWT verification error:", error.message);
        throw new ApiError(401, "Invalid Access Token");
    }
});

// ✅ Prevent already logged-in users from accessing login/register
export const isAuthenticated = asyncHandler(async (req, res, next) => {
    try {
        const token = req.cookies?.accessToken;

        if (token) {
            const isBlacklisted = await redis.get(`bl_${token}`);
            if (!isBlacklisted) {
                const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
                const user = await User.findById(decodedToken._id).select("-password -refreshToken");

                if (user) {
                    return res.status(400).json({ message: "You are already logged in." });
                }
            }
        }

        next();
    } catch (error) {
        next();
    }
});

// ✅ Prevent already logged-in sellers from accessing login/register
export const isSellerAutenticated = asyncHandler(async (req, res, next) => {
    try {
        const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "").trim();

        if (token) {
            const isBlacklisted = await redis.get(`bl_${token}`);
            if (!isBlacklisted) {
                const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
                const user = await Seller.findById(decodedToken._id).select("-password -refreshToken");

                if (user) {
                    return res.status(400).json({ message: "You are already logged in." });
                }
            }
        }

        next();
    } catch (error) {
        next();
    }
});

