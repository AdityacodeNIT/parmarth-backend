import { ObjectId } from "mongodb"; // Ensure ObjectId is imported
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Review } from "../models/review.models.js";
import { ApiResponse } from "../utils/ApiResponse.js";

// Function to add a review
const review = asyncHandler(async (req, res) => {
        const { rating, productId, message } = req.body;

        // Add new review to the database
        const reviews = await Review.create({ rating, productId, message });

        // Count the total number of reviews for the product

        // Return the created review and the total count of reviews
        return res.status(201).json(new ApiResponse(200, reviews));
});

// Function to calculate average rating using MongoDB aggregation
const averageReview = asyncHandler(async (req, res) => {
        const { productId } = req.body;
        console.log("Calculating average for productId:", productId);

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

        // const count = await Review.countDocuments({ productId });

        console.log("Aggregation result:", result);

        const averageRating = result.length > 0 ? result[0].averageRating : 0;
        const count = result.length > 0 ? result[0].count : 0;

        // console.log("Average rating calculated:", averageRating);

        // console.log("count of the document", count);

        // Return the average rating
        return res.json({ averageRating, count });
});

export { review, averageReview };
