import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";
import { deleteFromCloudinary, uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import Jwt from "jsonwebtoken";
import { generateOTP } from "../utils/otpGenerator.js";
import { sendOTP } from "../utils/Nodemailer.js";

const generateAccessAndRefreshToken = async (userId) => {
        try {
                const user = await User.findById(userId);
                if (!user) throw new ApiError(404, "User not found");

                const accessToken = user.generateAccessToken();
                const refreshToken = user.generateRefreshToken();

                // Store new refresh token
                user.refreshToken = refreshToken;
                await user.save({ validateBeforeSave: false });

                return { accessToken, refreshToken };
        } catch (error) {
                console.error("Error generating tokens:", error);
                throw new ApiError(500, "Error generating tokens");
        }
};

// registering user
const registerUser = asyncHandler(async (req, res) => {
    const { fullName, email, username, password } = req.body;

    if ([fullName, email, username, password].some(field => field?.trim() === "")) {
        throw new ApiError(400, "All fields are required");
    }

    const existedUser = await User.findOne({
        $or: [{ username }, { email }],
    });

    if (existedUser) {
        throw new ApiError(409, "User with email or username already exists");
    }

    const avatarlocalPath = req.files?.avatar?.[0]?.path;
    const coverImageLocalPath = req.files?.coverImage?.[0]?.path;

    let avatar, coverImage;

    if (avatarlocalPath) {
        try {
            avatar = await uploadOnCloudinary(avatarlocalPath);
        } catch (err) {
            throw new ApiError(500, "Error uploading avatar");
        }
    }

    if (coverImageLocalPath) {
        try {
            coverImage = await uploadOnCloudinary(coverImageLocalPath);
        } catch (err) {
            throw new ApiError(500, "Error uploading cover image");
        }
    }

    // Generate OTP before user creation
    const otp = generateOTP();

    // Create unverified user
    let user;
    try {
        user = await User.create({
            fullName,
            avatar: avatar?.url || "",
            coverImage: coverImage?.url || "",
            email,
            password,
            username: username.toLowerCase(),
            otp,
            otpExpiry: Date.now() + 5 * 60 * 1000,
            isVerified: false,
        });
    } catch (error) {
        throw new ApiError(500, "Error creating user in DB");
    }

    try {
        await sendOTP(email, otp);
    } catch (error) {
        console.error("OTP sending failed:", error);
        throw new ApiError(500, "Failed to send OTP");
    }

    return res.status(201).json({
        success: true,
        message: "OTP sent to email",
        userId: user._id, // Safe to store on frontend
    });
});


const loginUser = asyncHandler(async (req, res) => {
        const { email, username, password } = req.body;

        if (!username && !email) {
                throw new ApiError(400, "username or email is required");
        }

        const user = await User.findOne({
                $or: [{ username }, { email }],
        });

        if (!user) {
                throw new ApiError(404, "User does not exist");
        }

        const isPasswordValid = await user.isPasswordCorrect(password);

      
        if (!isPasswordValid) {
                throw new ApiError(401, "Invalid user credentials");
        }
             if (!user.isVerified) {
        throw new ApiError(403, "Please verify your email with the OTP first");
    }


        const { accessToken, refreshToken } =
                await generateAccessAndRefreshToken(user._id);

        const loggedInUser = await User.findById(user._id).select("-password ");

        const options = {
                httpOnly: true,
                secure: true,
                sameSite: "None",
        };

        return res

                .status(200)
                .cookie("refreshToken", refreshToken, options)
                .cookie("accessToken", accessToken, options)

                .json(
                        new ApiResponse(
                                200,
                                {
                                        user: loggedInUser,
                                },
                                "User logged In Successfully",
                        ),
                );
});

export const verifyOtp = asyncHandler(async (req, res) => {
    const { userId, otp } = req.body;
    console.log("Received userId:", userId);

    if (!userId || !otp) {
        throw new ApiError(400, "User ID and OTP are required");
    }

    const user = await User.findById(userId);
    if (!user) {
        throw new ApiError(404, "User not found");
    }

    if (user.isVerified) {
        return res.status(200).json(new ApiResponse(200, {}, "User already verified"));
    }

    // Check if OTP matches
    if (user.otp !== otp) {
        throw new ApiError(400, "Incorrect OTP");
    }

    // Check if OTP expired
    if (user.otpExpiry < Date.now()) {
        throw new ApiError(400, "OTP has expired");
    }

    // Mark user as verified and clear OTP fields
    user.isVerified = true;
    user.otp = undefined;
    user.otpExpiry = undefined;
    await user.save({ validateBeforeSave: false });

    return res.status(200).json(
        new ApiResponse(200, {}, "OTP verified successfully")
    );
});



const logOutUser = asyncHandler(async (req, res) => {
        if (!req.user) {
                return res
                        .status(401)
                        .json(new ApiResponse(401, {}, "Unauthorized"));
        }

        await User.findByIdAndUpdate(
                req.user?._id,
                { $unset: { refreshToken: 1 } },
                { new: true },
        );

        const options = {
                httpOnly: true,
                secure: true,
                sameSite: "None",
        };

        return res
                .status(200)
                .clearCookie("accessToken", options)
                .clearCookie("refreshToken", options)
                .json(new ApiResponse(200, {}, "User Logged Out"));
});


export const resendOTP = asyncHandler(async (req, res) => {
    const { email } = req.body;

    if (user.otpExpiry && user.otpExpiry > Date.now()) {
    throw new ApiError(429, "Please wait before requesting another OTP");
}


    if (!email || email.trim() === "") {
        throw new ApiError(400, "Email is required");
    }

    const user = await User.findOne({ email });

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    if (user.isVerified) {
        throw new ApiError(400, "User is already verified");
    }

    const { opt } = generateOTP(); // your OTP utility
    user.otp = opt;
    user.otpExpiry = Date.now() + 5 * 60 * 1000;

    await user.save({ validateBeforeSave: false });

    await sendOTP(email, opt); // your mail utility

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "OTP resent successfully"));
});


const refreshAccessToken = asyncHandler(async (req, res) => {
        const incomingrefreshToken = req.cookies.refreshToken;
        if (!incomingrefreshToken) {
                throw new ApiError(401, "Unauthorized Request");
        }

        try {
                const decodedToken = Jwt.verify(
                        incomingrefreshToken,
                        process.env.REFRESH_TOKEN_SECRET,
                );

                const user = await User.findById(decodedToken?._id);
                if (!user) {
                        throw new ApiError(401, "Invalid refresh token");
                }

                if (incomingrefreshToken !== user.refreshToken) {
                        throw new ApiError(
                                401,
                                "Refresh token is expired or does not match",
                        );
                }

                const currentAccessToken = req.cookies.accessToken;

                try {
                        Jwt.verify(
                                currentAccessToken,
                                process.env.ACCESS_TOKEN_SECRET,
                        ); // Try to verify it

                        return res
                                .status(200)
                                .json(
                                        new ApiResponse(
                                                200,
                                                "Access token is still valid",
                                        ),
                                );
                        // Generate new tokens
                } catch {
                        const { accessToken } =
                                await user.generateAccessToken();

                        const options = {
                                httpOnly: true,
                                secure: true,
                                // secure: process.env.NODE_VAR=="production",
                                sameSite: "None",
                        };

                        return res
                                .status(200)
                                .cookie("accessToken", accessToken, options)

                                .json(
                                        new ApiResponse(
                                                200,
                                                { accessToken },
                                                "Tokens refreshed successfully",
                                        ),
                                );
                }
        } catch (error) {
                console.error("Error during token refresh:", error);

                if (error.name === "TokenExpiredError") {
                        throw new ApiError(
                                401,
                                "Refresh token expired. Please log in again.",
                        );
                }

                throw new ApiError(
                        401,
                        error.message || "Invalid refresh token",
                );
        }
});

const changePassword = asyncHandler(async (req, res) => {
        const { currentPassword, newPassword, confirmPassword } = req.body;

        if (!(confirmPassword === newPassword)) {
                throw new ApiError(404, "password not matching");
        }

        const user = await User.findById(req.user?.id);
        const isPasswordCorrect = await user.isPasswordCorrect(currentPassword);

        if (!isPasswordCorrect) {
                throw new ApiError(400, "Invalid Password");
        }

        user.password = newPassword;

        await user.save({ validateBeforeSave: false });

        return res
                .status(200)
                .json(new ApiResponse(200, {}, "password changed succesfully"));
});


const getCurrentUser = asyncHandler(async (req, res) => {
        return res
                .status(200)
                .json(
                        new ApiResponse(
                                200,
                                req.user,
                                "current user fetched succesfully",
                        ),
                );
});

const updateAccountdetail = asyncHandler(async (req, res) => {
    const { fullName, email } = req.body;

    if (!(fullName || email)) {
        throw new ApiError(400, "All fields are required");
    }

    const userId = req.user?._id;
    if (!userId) {
        throw new ApiError(401, "Unauthorized - user not found in request");
    }

    // First, update the user
    await User.findByIdAndUpdate(
        userId,
        {
            $set: { fullName, email }
        },
        { new: true, runValidators: true }
    );

    // Now fetch the updated user properly
    const updatedUser = await User.findById(userId).select("-password");

    if (!updatedUser) {
        throw new ApiError(404, "User not found");
    }

    return res.status(200).json(
        new ApiResponse(
            200,
            updatedUser,
            "Account details updated successfully"
        )
    );
});


const updateUserAvatar = asyncHandler(async (req, res) => {
        const avatarLocalPath = req.file?.path;


        if (!avatarLocalPath) {
                throw new ApiError(400, "Avatar File is missing");
        }
        const avatar = await uploadOnCloudinary(avatarLocalPath);

        if (!avatar.url) {
                throw new ApiError(400, "error while uploading");
        }
        const currentUser = await User.findById(req.user?._id).select(
                "-password",
        );

        if (currentUser && currentUser.avatar) {
                await deleteFromCloudinary(currentUser.avatar);
        }

        console.log(avatar.url);

   

        const updatedUser = await User.findByIdAndUpdate(
  req.user?._id,
  { $set: { avatar: avatar.url } },
  { new: true }
).select("-password");

if (!updatedUser) {
  throw new ApiError(404, "User not found after avatar update");
}



        return res
                .status(200)
                .json(
                        new ApiResponse(
                                200,
                               {user:updatedUser},
                                "image updated succesfully",
                        ),
                );
});
export {
        registerUser,
        loginUser,
        logOutUser,
        refreshAccessToken,
        getCurrentUser,
        changePassword,
        updateAccountdetail,
        updateUserAvatar,
};
