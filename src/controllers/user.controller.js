import { asyncHandler } from '../utils/asyncHandler.js'
import APIError from '../utils/ApiError.js'
import { User } from '../models/user.model.js';
import uploadOnCloudinary from '../utils/cloudinary.js';
import ApiResponse from '../utils/ApiResponse.js';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';


const generateAccessandRefreshToken = async (userId) => {
    try {
        const user = await User.findById(userId);
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();


        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });

        return { accessToken, refreshToken }
    } catch (error) {
        throw new APIError(500, "Something went wrong while generating refresh and access token")
    }

}

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

    const { fullname, username, email, password } = req.body
    console.log(fullname, username, email, password);

    if ([fullname, username, email, password].some((field) => field.trim() === "")) {
        throw new APIError(400, "All fields are required")
    }

    const existerUser = await User.findOne({
        $or: [{ username }, { email }]
    })

    if (existerUser) {
        throw new APIError(409, "User with email or username already exists!")
    }

    console.log(req.files?.avatar[0].path)
    const avatarLocalPath = req.files?.avatar[0]?.path;


    let coverImageLocalPath;

    if (req.files && Array.isArray(req.files?.coverImage) && req.files?.coverImage.length > 0) {
        coverImageLocalPath = req.files?.coverImage[0]?.path;
    }


    if (!avatarLocalPath) {
        throw new APIError(400, "Avatar local file is required");
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if (!avatar) {
        throw new APIError(400, "Avatar file is required");
    }

    const user = await User.create({
        fullname,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        password,
        email,
        username: username.toLowerCase()
    })

    const createUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if (!createUser) {
        throw new APIError(500, "Something went wrong while registering the user")
    }

    return res.status(201).json(new ApiResponse(200, createUser, "User registered Successfully!"))
})

const userlogin = asyncHandler(async (req, res) => {
    const { email, username, password } = req.body;

    if (!username && !email) {
        throw new APIError(400, "username or password is required")
    }

    const existingUser = await User.findOne({
        $or: [{ username }, { email }]
    })

    if (!existingUser) {
        throw new APIError(404, "User does not exist")
    }
    console.log(existingUser)
    const isPasswordValid = await existingUser.isPasswordCorrect(password);

    if (!isPasswordValid) {
        throw new APIError(401, "Invalid user credentials")
    }

    const { accessToken, refreshToken } = await generateAccessandRefreshToken(existingUser._id);

    const loogedInUser = await User.findById(existingUser._id).select("-password -refreshToken");

    // these option stop modification from the frontend 
    const options = {
        httpOnly: true,
        secure: true
    }


    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(new ApiResponse(
            200,
            {
                user: loogedInUser,
                accessToken,
                refreshToken
            },
            "User logged In Successfully!"
        ))
})

const userLogout = asyncHandler(async (req, res) => {
    const existingUser = await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined
            }
        }
    )


    const options = {
        httpOnly: true,
        secure: true
    }

    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200, {}, "User logged Out"))

})

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if (!incomingRefreshToken) {
        throw new APIError(401, "unauthorized request")
    }

    const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEB_SECRET)

    const user = await User.findById(decodedToken?._id);

    if (!user) {
        throw new APIError(401, "Invalid refresh token")
    }

    if (incomingRefreshToken !== user.refreshToken) {
        throw new APIError(401, "Invalid refresh token")
    }

    const options = {
        httpOnly: true,
        secure: true
    }

    const { accessToken, refreshToken } = await generateAccessandRefreshToken(user._id);

    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(new ApiResponse(
            200,
            {
                user: loogedInUser,
                accessToken,
                refreshToken
            },
            "Access Token refresh Successfully!"
        ))
})

const changeCurrentPassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body;

    const existingUser = await User.findById(req.user._id);

    const isPasswordCorrect = await existingUser.isPasswordCorrect(oldPassword);

    if (!isPasswordCorrect) {
        throw new APIError(400, "Invalid old password!")
    }

    existingUser.password = newPassword;
    await existingUser.save({ validateBeforeSave: false });


    return res.status(200).json(new ApiResponse(
        200,
        {},
        "Password updated Successfully"
    ))
})

const getCurrentUser = asyncHandler(async (req, res) => {
    const existingUser = await User.findById(req.user._id);
    return res.status(200).json(new ApiResponse(
        200,
        existingUser,
        "Current user fetched Successfully"
    ))
})

const updateAccountDetails = asyncHandler(async (req, res) => {
    const { fullname, email } = req.body;

    if (!fullname || !email) {
        throw new APIError(400, "All fields are required")
    }

    const user = await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                fullname,
                email
            }
        },
        {
            new: true
        }
    ).select("-password")

    return res.status(200).json(new ApiResponse(
        200,
        user,
        "Account details updated Successfully"
    ))


})

const updateUserAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = req.file?.path

    if (!avatarLocalPath) {
        throw new APIError(400, "Avatar file is missing")
    }

    const avatar = uploadOnCloudinary(avatarLocalPath);

    if (!avatar.url) {
        throw new APIError(400, "Something is wrong while uploading avatar")
    }

    const user = await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                avatar: avatar.url
            }
        },
        {
            new: true
        }
    ).select("-password")

    return res.status(200).json(new ApiResponse(
        200,
        user,
        "Avatar Image updated Successfully"
    ))

})

const updateUserCoverImage = asyncHandler(async (req, res) => {
    const coverImageLocalPath = req.file?.path

    if (!coverImageLocalPath) {
        throw new APIError(400, "Cover image file is missing")
    }

    const coverImage = uploadOnCloudinary(coverImageLocalPath);

    if (!coverImage.url) {
        throw new APIError(400, "Something is wrong while uploading avatar")
    }

    const user = await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                coverImage: coverImage.url
            }
        },
        {
            new: true
        }
    ).select("-password")

    return res.status(200).json(new ApiResponse(
        200,
        user,
        "Cover Image updated Successfully"
    ))

})


const getUserChannelProfile = asyncHandler(async (req, res) => {
    const { username } = req.params;

    if (!username.trim()) {
        throw new APIError(401, "Username is missing")
    }

    const channel = await User.aggregate([
        {
            $match: {
                username: username?.toLowerCase()
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields: {
                subscriberCount: {
                    $size: "$subscribers"
                },
                channelsSubscribedToCounr: {
                    $size: "$subscribedTo"
                },
                isSubscribed: {
                    $cond: {
                        if: { $in: [req.user?._id, "$subscribers.subscriber"] },
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                fullname: 1,
                username: 1,
                subscriberCount: 1,
                channelsSubscribedToCounr,
                isSubscribed,
                avatar: 1,
                coverImage: 1
            }
        }
    ])

    if (!channel.length) {
        throw new APIError(404, "Channel does not exist")
    }

    return res
        .status(200)
        .json(new ApiResponse(
            200,
            channel[0],
            "User channel fetched Successfully"
        ))
})

const getWatchHistory = asyncHandler(async (req, res) => {
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        fullname: 1,
                                        username: 1,
                                        avatar: 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields: {
                            owner: {
                                $first: "$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])

    return res.status(200)
        .json(new ApiResponse(
            200,
            user[0].watchHistory,
            "Watch history fetch Successfully"
        ))


})

export {
    registerUser,
    userlogin,
    userLogout,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory
};