import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Address } from "../models/address.models.js";

// Add address
const addAddress = asyncHandler(async (req, res) => {
        const {
                name,
                streetAddress,
                city,
                state,
                country,
                postalCode,
                phoneNumber,
                alternateNumber,
        } = req.body;

        console.log(req.body);

        if (
                [
                        name,
                        streetAddress,
                        city,
                        state,
                        country,
                        postalCode,
                        phoneNumber,
                        alternateNumber,
                ].some((field) => field?.trim() === "")
        ) {
                throw new ApiError(401, "All fields are compulsory");
        }

        const address = await Address.create({
                name,
                streetAddress,
                city,
                state,
                country,
                postalCode,
                phoneNumber,
                alternateNumber,
                userId: req.user._id,
        });

        return res.status(201).json(address);
});

// Get address
const getAddress = asyncHandler(async (req, res) => {
        const address = await Address.findOne({ userId: req.user._id });

        if (!address) {
                throw new ApiError(404, "Address not found");
        }

        return res.status(200).json(address);
});

export { addAddress, getAddress };
