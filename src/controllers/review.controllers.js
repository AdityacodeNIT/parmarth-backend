import { ObjectId } from "mongodb"; // Ensure ObjectId is imported
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Review } from "../models/review.models.js";
import {Product} from "../models/product.models.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import mongoose from "mongoose";

const addReview = asyncHandler(async (req, res) => {
    const { productId, rating, message } = req.body;
    const userId = req.user.id;

    if (!productId || !rating) {
        throw new ApiError(400, "Product ID and rating are required");
    }
    const existingReview = await Review.findOne({ userId, productId });

   if (existingReview) {
  return res.status(400).json({
    success: false,
    message: 'You have already reviewed this product'
  });
}

  // 1️⃣ Create review
  const newReview = await Review.create({
    userId,
    productId,
    rating,
    message
  });

  // 2️⃣ Recalculate average rating
  const stats = await Review.aggregate([
    {
      $match: {
        productId: new mongoose.Types.ObjectId(productId)
      }
    },
    {
      $group: {
        _id: "$productId",
        avgRating: { $avg: "$rating" },
        reviewCount: { $sum: 1 }
      }
    }
  ]);

  const avgRating = stats[0]?.avgRating || 0;
  const reviewCount = stats[0]?.reviewCount || 0;

  // 3️⃣ Persist rating into Product
  const updatedProduct=await Product.findByIdAndUpdate(productId, {
    rating: avgRating,
    reviewCount
    
  },
  { new: true });
  console.log("updatedProduct",updatedProduct)

  res
    .status(201)
    .json(new ApiResponse(201, newReview, "Review added successfully"));
});

   
   
const averageReview = asyncHandler(async (req, res) => {
        const { productId } = req.body;
        const objectId = new ObjectId(productId);
    
         const result = await Review.aggregate([
                {
                        $match: { productId: objectId },
                },
                {
                        $group: {
                                _id: "$productId",
                                averageRating: { $avg: "$rating" },
                                count: { $sum: 1 },
                        },
                },
        ]);
        // Return the average rating and the total count
        const averageRating = result.length > 0 ? result[0].averageRating : 0;
        const count = result.length > 0 ? result[0].count : 0;
        return res.json({ averageRating, count });
});

const getReview = asyncHandler(async (req, res) => {
        const id  = req.params.id;
        const reviews = await Review.find({productId:id}).populate("userId", "fullName"); // Populate userId with name and email fields
      
        if (reviews.length === 0) {
            throw new ApiError(404, "No reviews found");
        } 
    
        res.json(reviews);
    });
    

export { addReview, averageReview,getReview };
