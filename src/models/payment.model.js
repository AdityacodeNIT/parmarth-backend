import mongoose,{Schema} from "mongoose";

const paymentSchema = new Schema(
  {
    razorpayOrderId: { type: String, required: true, index: true },
    razorpayPaymentId: String,
    razorpaySignature: String,
    amount: { type: Number, required: true },
    currency: { type: String, default: "INR" },
    status: {
      type: String,
      enum: ["created", "captured", "failed", "refunded"],
      default: "created",
    },
    userId: { type: Schema.Types.ObjectId, ref: "User", },
   // orderRef: { type: Schema.Types.ObjectId, ref: "Order" },
    refundId: String,
    emailAtPayment:String,
  },
  { timestamps: true }
);

paymentSchema.index({ createdAt: -1 })

export const  Payment= mongoose.model("Payment", paymentSchema);
