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
      enum: ["Writing", "Paper", "DeskSupplies", "Filling", "Reusable"],
      required: true,
    },
  },
  { timestamps: true },
);

export const Product = mongoose.model("Product", ProductSchema);
