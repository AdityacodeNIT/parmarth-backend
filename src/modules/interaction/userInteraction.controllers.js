import { ApiError } from "../../utils/ApiError.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { UserInteraction } from "./userInteraction.model.js";
import { uploadOnCloudinary } from "../../utils/cloudinary.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import Jwt from "jsonwebtoken";


export const getRecommendations = asyncHandler(async (req, res) => {
    const { userId } = req.params;

    const interactions = await UserInteraction.find({ userId });
    if (!interactions.length) {
      throw new ApiError(404,  "No user interactions found");
    }

    try{

    const response = await axios.get(`http://127.0.0.1:5001/recommend/${userId}`);
    const recommendedProductIds = response.data.recommended_products;

    // 🔹 Fetch product details from MongoDB
    const recommendedProducts = await Product.find({ _id: { $in: recommendedProductIds } });

    res.json({ userId, recommendedProducts });
  } catch (error) {
    console.error("Error fetching recommendations:", error);
    throw new ApiError(500, "Internal Server Error");
  }
});
