import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Review } from "../models/review.models.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const review = asyncHandler(async (req, res) => {
  const { rating, productId } = req.body;

  const reviews = await Review.create({
    rating,
    productId,
  });
  let count = await Review.countDocuments({ productId });
  if (!reviews) {
    throw new ApiError(500, "review not added");
  }

  return res.status(201).json(new ApiResponse(200, reviews, count));
});

const averageReview = asyncHandler(async (req, res) => {
  const { productId } = req.body;
  let average = await Review.countDocuments({ productId });
  return res.json(average);
});

const setAverageReview = asyncHandler(async (req, res) => {
  const { productId } = req.body;
  let average = await Review.find({ productId }).select("rating -_id");
  const value = average.reduce((total, average) => {
    return total + average.rating;
  }, 0);
  return res.json(value);
});

export { review, averageReview, setAverageReview };
