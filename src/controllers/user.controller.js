import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import Jwt from "jsonwebtoken";

/*this is the function for generating access tokenwhere we can use these
                token by exporting them from dataset because they are quite common*/

const generateAccessAndRefreshtoken = async (userId) => {
        try {
                const user = await User.findById(userId);
                const accessToken = user.generateAccessToken();
                const refreshToken = user.generateRefreshToken();

                user.refreshToken = refreshToken;
                await user.save({ validateBeforeSave: false });

                return { accessToken, refreshToken };
        } catch (error) {
                // Log the original error for debugging purposes
                throw new ApiError(
                        500,
                        "Something went wrong while generating referesh and access token",
                );
        }
};

/***** starting here ****/

const registerUser = asyncHandler(async (req, res) => {
        // get user details from frontend
        // validation - not empty
        // check if user already exists: username, email
        // check for images, check for avatar
        // upload them to cloudinary, avatar
        // create user object - create entry in db
        // remove password and refresh token field from response
        // check for user creation
        // return res

        const { fullName, email, username, password } = req.body;
        if (
                [fullName, email, username, password].some(
                        (feild) => feild?.trim() === "",
                )
        ) {
                throw new ApiError(400, "All feilds are complsory");
        }

        const existedUser = await User.findOne({
                $or: [{ username }, { email }],
        });

        if (existedUser) {
                throw new ApiError(
                        409,
                        "User with email or username already exists",
                );
        }

        const avatarlocalPath = req.files?.avatar[0]?.path;

        let coverImageLocalPath;

        if (
                req.files &&
                Array.isArray(req.files.coverImage) &&
                req.files.coverImage.length > 0
        ) {
                coverImageLocalPath = req.files?.path;
        }

        if (!avatarlocalPath) {
                throw new ApiError(400, "Avatar file is required");
        }
        const avatar = await uploadOnCloudinary(avatarlocalPath);

        const coverImage = await uploadOnCloudinary(coverImageLocalPath);

        // console.log("Avatar URL : ", avatar)

        // console.log("Avatar URL : ", coverImage)
        if (!avatar) {
                throw new ApiError(400, "Avatar file is required");
        }

        const user = await User.create({
                fullName,
                avatar: avatar.url,
                coverImage: coverImage?.url || "",
                email,
                password,
                username: username.toLowerCase(),
        });

        const createdUser = await User.findById(user._id).select(
                "-password -refreshToken",
        );

        if (!createdUser) {
                throw new ApiError(
                        500,
                        "Something went wrong while registering a user",
                );
        }

        return res
                .status(201)
                .json(
                        new ApiResponse(
                                200,
                                createdUser,
                                " Registered succesfully",
                        ),
                );
});

const loginUser = asyncHandler(async (req, res) => {
        // req body -> data
        // username or email
        //find the user
        //password check
        //access and referesh token
        //send cookie

        const { email, username, password } = req.body;

        if (!username && !email) {
                throw new ApiError(400, "username or email is required");
        }

        // if (!(username || email)) {
        //     throw new ApiError(400, "username or email is required")

        // }

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

        const { accessToken, refreshToken } =
                await generateAccessAndRefreshtoken(user._id);

        const loggedInUser = await User.findById(user._id).select(
                "-password -refreshToken",
        );

        const options = {
                httpOnly: true,
                secure: true,
        };
        return res
                .status(200)
                .cookie("accessToken", accessToken, options)
                .cookie("refreshToken", refreshToken, options)

                .json(
                        new ApiResponse(
                                200,
                                {
                                        user: loggedInUser,
                                        accessToken,
                                        refreshToken,
                                },
                                "User logged In Successfully",
                        ),
                );
});

// logout User

const logOutUser = asyncHandler(async (req, res) => {
        await User.findByIdAndUpdate(
                req.user?._id,

                {
                        $unset: {
                                refreshToken: 1,
                        },
                },
                {
                        new: true,
                },
        );

        const options = {
                httpOnly: true,
                secure: true,
        };
        return res
                .status(200)
                .clearCookie("accessToken", options)
                .clearCookie("refreshToken", options)
                .json(new ApiResponse(200, {}, "User Logged Out"));
});
// incoming refresh token

const refreshAccessToken = asyncHandler(async (req, res) => {
        const incomingrefreshToken =
                req.cookies.refreshToken || req.body.refreshToken;

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
                        throw new ApiError(401, "invalid refreshToken");
                }
                if (incomingrefreshToken !== user?.refreshToken) {
                        throw new ApiError(
                                401,
                                "refresh token is expired or match",
                        );
                }

                const options = {
                        httpOnly: true,
                        secure: true,
                };

                const { accessToken, newRefreshToken } =
                        await generateAccessAndRefreshtoken(user._id);

                return res
                        .status(200)
                        .cookie("accessToken", accessToken, options)
                        .cookie("refreshToken", newRefreshToken, options)
                        .json(
                                new ApiResponse(
                                        200,
                                        {
                                                accessToken,
                                                refreshToken: newRefreshToken,
                                        },
                                        "refresh token is make",
                                ),
                        );
        } catch (error) {
                throw new ApiError(error?.message, "this is the error");
        }
});

const changePassword = asyncHandler(async (req, res) => {
        const { oldPassword, newPassword, confPassword } = req.body;

        if (!(confPassword === newPassword)) {
                throw new ApiError(404, "password not matching");
        }

        const user = await User.findById(req.user?.id);
        const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

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
                throw new ApiError(400, "All feilds are required");
        }
        const updateuser = await User.findByIdAndUpdate(
                req.user?._id,
                {
                        $set: {
                                fullName,
                                email: email,
                        },
                },
                { new: true },
        ).select("-password");
        return res
                .status(200)
                .json(
                        new ApiResponse(
                                200,
                                updateuser,
                                "Account details updated succesfully",
                        ),
                );
});

const updateUserAvatar = asyncHandler(async (req, res) => {
        const avatarLocalPath = req.files?.path;
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

        const updateuser = await User.findByIdAndUpdate(
                req.user?._id,
                {
                        $set: { avatar: avatar.url },
                },
                { new: true },
        ).select("-password");

        return res
                .status(200)
                .json(
                        new ApiResponse(
                                200,
                                updateuser,
                                "image updated succesfully",
                        ),
                );
});

// const userAvatarTobeDeleted = asyncHandler(async (req, res) => {
//   const deleteuser = await user.findByIdAndUpdate;
// });
const getUserChnanelProfile = asyncHandler(async (req, res) => {
        const { username } = req.params;

        if (!username?.trim) {
                throw new ApiError(400, "Username is missing");
        }
        await User.aggregate([
                {
                        $match: {
                                username: username?.toLowerCase(),
                        },
                },
                {
                        $lookup: {
                                from: "subscriptions",
                                localField: "_id",
                                foreignField: "channel",
                                as: "Subscribers",
                        },
                },
                {
                        $lookup: {
                                from: "subscriptions",
                                localField: "_id",
                                foreignField: "subscribers",
                                as: "subscribedTo",
                        },
                },
                {
                        $addFields: {
                                subscribersCount: {
                                        $size: "$subscribers",
                                },
                                channelsSubscribedToCount: {
                                        $size: "$subscribedTo",
                                },
                                isSubscibed: {
                                        $cond: {
                                                if: {
                                                        $in: [
                                                                req.user?._id,
                                                                "$subscribers.subscriber",
                                                        ],
                                                },
                                                then: true,
                                                else: false,
                                        },
                                },
                        },
                },
                {
                        $project: {
                                fullName: 1,
                                username: 1,
                                subscribersCount: 1,
                                isSubscibed: 1,
                                email: 1,
                                avatar: 1,
                        },
                },
        ]);

        if (!channel?.length) {
                throw new ApiError(404, "array does not exist");
        }
        return res
                .status(200)
                .json(
                        new ApiResponse(
                                200,
                                channel[0],
                                "User channel fethced succesfully",
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
        getUserChnanelProfile,
};
