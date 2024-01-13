import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError} from '../utils/ApiError.js'
import { User } from '../models/user.model.js'
import { uploadOnCloudinary } from '../utils/cloudinary.js'
import { ApiResponse } from '../utils/ApiResponse.js'


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
    console.log("email:",email)

    if(
        [ fullName,email,username,password ].some((field)=> field?.trim() === "")
    ){
        throw new ApiError(400, "All fields are required")
    }

    const existedUser = User.findOne({
        $or: [{username},{email}]
    })

    if(existedUser){
        throw new ApiError(409, "Username or email already exists")
    }

       const avatarLocalPath = req.files?.avatar[0]?.path
       const coverImageLocalPath = req.files?.coverImage[0]?.path

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


export { registerUser }

