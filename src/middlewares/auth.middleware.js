import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";

export const verifyJWT = asyncHandler(async (req, _, next) => {
        try {
                const token =
                        req.cookies?.accessToken ||
                        req.header("Authorization")?.replace("Bearer", "");

                if (!token) {
                        throw new ApiError(401, "token is not present");
                }

                if (typeof token !== "string") {
                        throw new ApiError(401, "type of token must be string");
                } else if (token) {
                        console.log("token is here " + token);
                }

                const decodedToken = jwt.verify(
                        token,
                        process.env.ACCESS_TOKEN_SECRET,
                );

                const user = await User.findById(decodedToken?._id).select(
                        "-password -refreshToken",
                );

                if (!user) {
                        throw new ApiError(401, "Invalid Access Token");
                }
                req.user = user;
                next();
        } catch (error) {
                console.error(error);
                throw new ApiError(
                        401,
                        error.message || "inavlid access token",
                );
        }
});
