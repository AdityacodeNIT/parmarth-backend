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

                        // Orderdate: {
                        //         type: Date,
                        //         default: Date.now, // Automatically sets the current date when a new document is created
                        // },
                        // DeliveryDate: {
                        //         type: Date,
                        //         default: Date.now + 3,
                        // },

                        status: {
                                type: String,
                                enum: ["PENDING", "CANCELLED", "DELIVERED"],
                                default: "PENDING",
                        },
                },
                { timestamps: true },
        );

        export const Order = mongoose.model("Order", orderSchema);
