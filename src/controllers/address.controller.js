import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Address } from "../models/address.models.js";

// Add address
const addAddress = asyncHandler(async (req, res) => {
      
        const {
                firstName,
                lastName,
                streetAddress,
                city,
                state,
                country,
                postalCode,
                phoneNumber,
                alternateNumber,
        } = req.body;

       
        if (
                [
                        firstName,
                        lastName,
                        streetAddress,
                        city,
                        state,
                        country,
                        postalCode,
                        phoneNumber,
                        alternateNumber,
                ].some((field) => !field || field.trim() === "")
        )

         {   throw new ApiError(400, "All fields are compulsory"); }

        const address = await Address.create({
                firstName,
                lastName,
                streetAddress,
                city,
                state,
                country,
                postalCode,
                phoneNumber,
                alternateNumber,
                userId: req.user._id,
        });

        return res
                .status(201)
                .json(
                        new ApiResponse(
                                201,
                                "Address added successfully",
                                address,
                        ),
                );
});

// Get address
const getAddress = asyncHandler(async (req, res) => {
        const address = await Address.findOne({ userId: req.user._id });

        if (!address) {  
                // Return a response indicating no address is found
                return res
                        .status(200)
                        .json(
                                new ApiResponse(
                                        200,
                                        null,
                                        true,
                                        "No address found for this user",
                                     
                                ),
                        );
        }

        return res
                .status(200)
                .json(
                        new ApiResponse(
                                200,
                                address,
                                "Address retrieved successfully",
                        ),
                );
});

const getAllAddresses=asyncHandler(async(req,res)=>{
        const alladresses=await Address.find({userId:req.user._id});
        if(!alladresses){
                return res.
                status(200).json(
                        new ApiResponse(
                                200,
                                null,
                                false,
                                "No address found for this user",
                             
                        ), 
                )
                
        }

        return res.
        status(200).json(
                new ApiResponse(
                        200,
                        alladresses,
                        true,
                        "Addresses retrieved successfully",

                ), 
        )
})

export { addAddress, getAddress,getAllAddresses };

