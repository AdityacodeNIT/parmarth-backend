import mongoose, { Schema } from "mongoose";

const reviewSchema = new Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: "User",
        },
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: "Product",
        },
        rating: {
            type: Number,
            required: true,
        },
        message: {
            type: String,
            default: " ",
            required: true,
        },
    },
    { timestamps: true }
);


reviewSchema.index({ userId: 1, productId: 1 }, { unique: true });

export const Review = mongoose.model("Review", reviewSchema);
