import mongoose, { Schema } from "mongoose";

const orderSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    items: [
      {
        productId: {
          type: Schema.Types.ObjectId,
          required: true,
          ref: "Product",
        },
        name: { type: String },
        quantity: { type: Number },
        price: { type: Number },
      },
    ],
  },
  { timestamps: true },
);

export const Order = mongoose.model("Order", orderSchema);
