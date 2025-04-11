import { ObjectId } from "mongodb"; // Ensure ObjectId is imported
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Review } from "../models/review.models.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const review = async (req, res) => {
    try {
        const { productId, rating, message } = req.body;
        const userId = req.user.id; // Assuming user is authenticated

        // 🔴 Check if the user already reviewed this product
        const existingReview = await Review.findOne({ userId, productId });

        if (existingReview) {
            return res.status(400).json({ message: "You have already reviewed this product" });
        }

        // ✅ Create new review
        const newReview = await  Review.create({ userId, productId, rating, message });

        return res.status(201).json(new ApiResponse(200, newReview));
    } catch (error) {
        console.error("Error adding review:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};


const averageReview = asyncHandler(async (req, res) => {
        const { productId } = req.body;
        // Convert productId to ObjectId
        const objectId = new ObjectId(productId);
        // Aggregation to calculate the average rating for the product
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
    

export { review, averageReview,getReview };
