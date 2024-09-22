import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Address } from "../models/address.models.js";

const getUserAddress = asyncHandler(async (req, res) => {
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
    ].some((feild) => feild?.trim() === "")
  ) {
    throw new ApiError(401, "All feilds are complsory");
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
  });

  return res.status(201).json(address);
});

export { getUserAddress };
