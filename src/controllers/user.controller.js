import { asyncHandler } from '../utils/asyncHandler.js'
import APIError from '../utils/ApiError.js'
import { User } from '../models/user.model.js';
import uploadOnCloudinary from '../utils/cloudinary.js';
import ApiResponse from '../utils/ApiResponse.js';

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

    if (!username || !email) {
        throw new APIError(400, "username or password is required")
    }

    const existingUser = await User.find({
        $or: [{ username }, { email }]
    })

    if (!existingUser) {
        throw new APIError(404, "User does not exist")
    }

    const isPasswordValid = await existingUser.isPasswordCorrect();

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

export { registerUser, userlogin, userLogout };