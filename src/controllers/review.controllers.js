import { ObjectId } from "mongodb"; // Ensure ObjectId is imported
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Review } from "../models/review.models.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const addReview = asyncHandler(async (req, res) => {
    const { productId, rating, message } = req.body;
    const userId = req.user.id;

    if (!productId || !rating) {
        throw new ApiError(400, "Product ID and rating are required");
    }
    const existingReview = await Review.findOne({ userId, productId });

    if (existingReview) {
        throw new ApiError(400, "You have already reviewed this product");
    }
    const newReview = await Review.create({ userId, productId, rating, message });

    res.status(201).json(new ApiResponse(201, newReview, "Review added successfully"));
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
