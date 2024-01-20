import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError} from '../utils/ApiError.js'
import { User } from '../models/user.model.js'
import { uploadOnCloudinary } from '../utils/cloudinary.js'
import { ApiResponse } from '../utils/ApiResponse.js'
import jwt from 'jsonwebtoken'

const generateAccessAndRefreshToken = async (userId) =>{
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false })  

        return { accessToken, refreshToken}

    } catch (error) {
        console.log(error)
        throw new ApiError(500,"Something went wrong while generating access and refresh token")
    }
}

const registerUser = asyncHandler(async (req, res) => {
    //1. get user details from frontend
    //2. validate user details - not emply
    //3. check if user already exists: username, email
    //4. check for image, check for avatar
    //5. upload image to cloudinary, avatar
    //6. create user object - create entry in db
    //7. remove password and refresh token filed from response
    //8. check for user creation
    //9.  return response

    const { username, email, fullName, password } = req.body
    // console.log("email:",email)

    if(
        [ fullName,email,username,password ].some((field)=> field?.trim() === "")
    ){
        throw new ApiError(400, "All fields are required")
    }

    const existedUser = await User.findOne({
        $or: [{username},{email}]
    })

    if(existedUser){
        throw new ApiError(409, "Username or email already exists")
    }

       const avatarLocalPath = req.files?.avatar[0]?.path
    //    const coverImageLocalPath = req.files?.coverImage[0]?.path
    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
        coverImageLocalPath = req.files.coverImage[0].path
    }

       if(!avatarLocalPath){
        throw new ApiError(400, "Avatar is required")
       }

       const avatar = await uploadOnCloudinary(avatarLocalPath)
       const coverImage = await uploadOnCloudinary(coverImageLocalPath)

       if(!avatar){
        throw new ApiError(400, "Avatar is required")
       }

      const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage:coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()
       })

       const userCreated = await User.findById(user._id).select(
        "-password -refreshToken"
       )

       if(!userCreated){
        throw new ApiError(500, "User creation failed!")
       }

       return res.status(201).json(
        new ApiResponse(200, userCreated, "User created successfully")
       )
})

const loginUser = asyncHandler(async(req,res)=>{
    //1. req.body -> data
    // 2. username or email
    // find the user
    // password check
    // access token and refresh token
    // send cookies

    const { email,username, password } = req.body;
    
    if(!email || username){
        throw new ApiError(400, "Email or username is required")                                                                                                                                                                                                                
    }

   const user = await User.findOne({
        $or: [{email},{username}]
    })

    if(!user){
        throw new ApiError(404, "User not found")                                                                               
    }

    const isPasswordValid = await user.isPasswordCorrect(password)

    if(!isPasswordValid){
        throw new ApiError(401, "Password is incorrect")                                                                             
    }

   const { accessToken, refreshToken } = await generateAccessAndRefreshToken(user._id)

   const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

   const options = {
       httpOnly:true,
       secure:true
   }
   
   return res.status(200).cookie("accessToken", accessToken, options).cookie("refreshToken", refreshToken, options).json(
    new ApiResponse(
        200,
        {
            user: loggedInUser,accessToken,refreshToken
        },
        "User logged in successfully"
    )
   )
})

const logoutUser = asyncHandler(async(req,res)=>{
  await User.findByIdAndUpdate(
        req.user._id,
        {
            $set :{
                refreshToken:undefined
            }
        },
        {
            new:true
        }
    )

    const options = {
        httpOnly:true,
        secure:true
    }

    return res.status(200).clearCookie("accessToken", options).clearCookie("refreshToken", options).json(
        new ApiResponse(200, {}, "User logged out successfully")
    )
})

const refreshAccessToken = asyncHandler(async(req,res)=>{
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if(!incomingRefreshToken){
        throw new ApiError(401, "Unauthorized request")
    }

    const decodedToken = jwt.verify(incomingRefreshToken, process.env.ACCESS_TOKEN_SECRET)

    const user = await User.findById(decodedToken?._id)

    if(!user){
        throw new ApiError(401, "Invalid refresh token")
    }

    if(incomingRefreshToken !== user?.refreshToken){
        throw new ApiError(401, "Refresh token is expired")
    }

    const options = {
        httpOnly:true,
        secure:true
    }

    const  { accessToken, newrefreshToken} = await generateAccessAndRefreshToken(user._id);

    res.status(200).cookie("accessToken", accessToken, options).cookie("refreshToken", newrefreshToken, options).json(
        new ApiResponse(
            200,
            {
                accessToken,newrefreshToken
            },
            "Access token refreshed successfully"
        )
    )

})

const changeCurrentPassword =  asyncHandler(async(req,res)=>{

    const { oldPassword, newPassword } = req.body

    const user = await User.findById(req.user?._id)

    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    if(!isPasswordCorrect){
        throw new ApiError(400,'Invalid old password')
    }

    user.password = newPassword

   await user.save({ validateBeforeSave: false })

   return res.status(200).json(
       new ApiResponse(200, "Password changed successfully")
   )
})

const getCurrentUser = asyncHandler(async(req,res)=>{
    return res.status(200).json(
        200, req.user, "User details fetched successfully"
    )
})

const updateAccountDetails = asyncHandler(async(req,res)=>{
    const { fullName, email } = req.body;

    if(!fullName || !email){
        throw new ApiError(400, "All fields are required")
    }

    const user = User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                fullName:fullName,
                email:email
            }
    },
        { new:true }
    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200, user, "User details updated successfully"))
})

const updateUserAvatar = asyncHandler(async(req,res)=>{

    const avatarLocalPath = req.file?.path

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar is required")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if(!avatar.url){
        throw new ApiError(400, "Avatar upload failed")
    }

    const user = User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                avatar:avatar.url
            }
        },
        { new:true }
    ).select("-password")

    return res.status(200).json(
        new ApiResponse(200, user, "Avatar updated successfully")
    )

})

const updateUserCoverImage = asyncHandler(async(req,res)=>{

    const coverImageLocalPath = req.file?.path

    if(!coverImageLocalPath){
        throw new ApiError(400, "coverImage is required")
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!coverImage.url){
        throw new ApiError(400, "coverImage upload failed")
    }

    const user = User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                coverImage:coverImage.url
            }
        },
        { new:true }
    ).select("-password")

    return res.status(200).json(
        new ApiResponse(200, user, "coverImage updated successfully")
    )
    })

export {
     registerUser,
     loginUser,
     logoutUser,
     refreshAccessToken,
     changeCurrentPassword,
     getCurrentUser,
     updateAccountDetails,
     updateUserAvatar,
     updateUserCoverImage
}

