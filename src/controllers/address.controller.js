import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Address } from "../models/address.models.js";
import mongoose from "mongoose"; // or const mongoose = require('mongoose');
const { Types } = mongoose;


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
  try {
    const { ObjectId } = Types;



    const userId = new ObjectId(req.user._id.toString());
    const addressId = new ObjectId(req.params.id);



    const address = await Address.findOne({
      userId,
      _id: addressId,
    });

    console.log("📦 Address found:", address);

    if (!address) {
      return res.status(200).json(
        new ApiResponse(200, null, true, "No address found for this user")
      );
    }

    return res.status(200).json(
      new ApiResponse(200, address, "Address retrieved successfully")
    );
  } catch (error) {
    console.error("❌ Error in getAddress:", error);
    return res
      .status(500)
      .json(new ApiResponse(500, null, false, error.message));
  }
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

