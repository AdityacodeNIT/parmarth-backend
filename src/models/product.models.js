import mongoose, { Schema } from "mongoose";

const ProductSchema = new Schema(
        {
                name: {
                        type: String,
                        required: true,
                },
                price: {
                        type: Number,
                        required: true,
                },
                description: {
                        type: String,
                },
                ProductImage: {
                        type: String,
                        required: true,
                },
                Category: {
                        type: String,
                        enum: [
                                "Writing",
                                "Paper",
                                "DeskSupplies",
                                "Filling",
                                "Reusable",
                        ],
                        required: true,
                },
                stocks: {
                        type: Number,
                        required: true,
                },
                length: {
                        type: Number,
                        required: true, // Length in cm
                },
                breadth: {
                        type: Number,
                        required: true, // Breadth in cm
                },
                height: {
                        type: Number,
                        required: true, // Height in cm
                },
                weight: {
                        type: Number,
                        required: true, // Weight in kg
                },
        },
        { timestamps: true },
);

export const Product = mongoose.model("Product", ProductSchema);
