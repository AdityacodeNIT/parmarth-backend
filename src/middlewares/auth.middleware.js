import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import  jwt  from "jsonwebtoken";
import { User } from "../models/user.model.js";

export const verifyJWT=asyncHandler(async(req,_,next)=>
{
 
try {
    const token= req.cookies?.refreshToken|| req.header("Authorization")?.replace("Bearer ","")
    
if (!token || typeof token !== 'string') {
    throw new ApiError(401, "Token must be a string");
}
// error zone 
    if(!token) {
          throw new ApiError(401,"unauthorized request")
    }

  const decodedToken=  jwt.verify(token, process.env.REFRESH_TOKEN_SECRET)


const user= await User.findById(decodedToken?._id).select(
        "-password -refreshToken "
    )
    
    if(!user){
        throw new ApiError(401,"invalid Access token")
    }

    req.user=user;
    next();

} catch (error) {
    throw new ApiError(401,error.message||"inavlid access token")
}

})