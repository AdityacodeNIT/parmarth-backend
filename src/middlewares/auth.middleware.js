import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";
import { Seller } from "../models/seller.model.js";

import logger from "../utils/logger.js";

export const verifyJWT = asyncHandler(async (req, res, next) => {
        try {
                const token = req.cookies?.accessToken || 
                             req.header("Authorization")?.replace("Bearer ", "").trim();

                if (!token) {
                        throw new ApiError(401, "Access token is required");
                }

                const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
                console.log('Decoded JWT token:', decodedToken);

                // Get user and check if account is active
                const user = await User.findById(decodedToken._id).select(
                        "-password -refreshToken -twoFactorSecret"
                );
                console.log('User fetched from DB:', user);

                if (!user) {
                        throw new ApiError(401, "User not found");
                }

                if (!user.isActive) {
                        throw new ApiError(403, "Account has been deactivated");
                }

                if (user.isLocked) {
                        throw new ApiError(423, "Account is temporarily locked");
                }

                // Attach user and token info to request
                console.log('Authenticated user:', user.email, 'Role:', user.role);
                req.user = user;
                req.token = token;
                req.tokenPayload = decodedToken;

                // Log request for audit
                logger.logRequest(req, res, 0);

                next();
        } catch (error) {
                if (error.name === 'TokenExpiredError') {
                        logger.warn('Expired token used', { 
                                ip: req.ip, 
                                userAgent: req.get('User-Agent') 
                        });
                        throw new ApiError(401, "Access token has expired");
                }
                
                if (error.name === 'JsonWebTokenError') {
                        logger.warn('Invalid token used', { 
                                ip: req.ip, 
                                userAgent: req.get('User-Agent') 
                        });
                        throw new ApiError(401, "Invalid access token");
                }

                if (error instanceof ApiError) {
                        throw error;
                }

                logger.error("JWT verification error", { 
                        error: error.message,
                        ip: req.ip,
                        userAgent: req.get('User-Agent')
                });
                throw new ApiError(401, "Authentication failed");
        }
});

export const verifySeller = asyncHandler(async (req, _, next) => {
        try {
                const token =
                        req.cookies.accessToken ||
                        req
                                .header("Authorization")
                                ?.replace("Bearer ", "")
                                .trim();

                if (!token) {
                        throw new ApiError(401, "Token is not present");
                }

                const decodedToken = jwt.verify(
                        token,
                        process.env.ACCESS_TOKEN_SECRET,
                );

                const seller = await Seller.findById(decodedToken._id).select(
                        "-password -refreshToken",
                );
                console.log(seller)

                if (!seller) {
                        throw new ApiError(401, "Invalid Access Token");
                }

                req.seller = seller; // Attach user to req
                next();
        } catch (error) {
                console.error("JWT verification error:", error.message);
                throw new ApiError(401, "Invalid Access Token");
        }
});





export const isAuthenticated = asyncHandler(async (req, res, next) => {
        try {
            const token =
                req.cookies?.accessToken ||
                req.header("Authorization")?.replace("Bearer ", "").trim();
    
            if (token) {
          
                const decodedToken = await jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    
              
                const user = await User.findById(decodedToken._id).select("-password -refreshToken");
    
                if (user) {
                    return res.status(400).json({ message: "You are already logged in." });
                }
            }
    
            next();
        } catch (error) {
         
            next();
        }
    });


    export const isSellerAutenticated= asyncHandler(async (req, res, next) => {
        try {
            const token =
                req.cookies?.accessToken ||
                req.header("Authorization")?.replace("Bearer ", "").trim();
    
            if (token) {
          
                const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    
              
                const user = await Seller.findById(decodedToken._id).select("-password -refreshToken");
    
                if (user) {
                    return res.status(400).json({ message: "You are already logged in." });
                }
            }
    
            next();
        } catch (error) {
         
            next();
        }
    });
