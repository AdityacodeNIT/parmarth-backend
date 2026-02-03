import mongoose, { Schema } from "mongoose";

const returnSchema = new Schema(
  {
    // Order reference
    orderId: {
      type: String,
      required: true,
      index: true,
    },
    shiprocketOrderId: {
      type: String,
      required: true,
    },
    
    // User information
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    userEmail: {
      type: String,
      required: true,
    },
    userName: {
      type: String,
      required: true,
    },

    // Return details
    items: [
      {
        productId: {
          type: Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        productName: String,
        sku: String,
        quantity: {
          type: Number,
          required: true,
          min: 1,
        },
        price: Number,
        reason: {
          type: String,
          required: true,
        },
      },
    ],

    // Return reason and details
    returnReason: {
      type: String,
      required: true,
      enum: [
        "Defective Product",
        "Wrong Item Received",
        "Size/Fit Issue",
        "Quality Not as Expected",
        "Changed Mind",
        "Product Damaged",
        "Missing Parts/Accessories",
        "Other",
      ],
    },
    returnDescription: {
      type: String,
      required: true,
      maxlength: 500,
    },
    images: [
      {
        url: String,
        description: String,
      },
    ],

    // Return status
    status: {
      type: String,
      enum: [
        "REQUESTED",
        "APPROVED",
        "REJECTED",
        "PICKUP_SCHEDULED",
        "PICKED_UP",
        "IN_TRANSIT",
        "RECEIVED",
        "INSPECTED",
        "REFUND_INITIATED",
        "REFUND_COMPLETED",
        "CANCELLED",
      ],
      default: "REQUESTED",
      index: true,
    },

    // Shiprocket return details
    shiprocketReturnId: String,
    shiprocketAwbCode: String,
    pickupScheduledDate: Date,
    pickupAddress: {
      name: String,
      address: String,
      city: String,
      state: String,
      pincode: String,
      phone: String,
    },

    // Admin review
    adminReview: {
      reviewedBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
      reviewedAt: Date,
      decision: {
        type: String,
        enum: ["APPROVED", "REJECTED"],
      },
      notes: String,
    },

    // Inspection details
    inspection: {
      inspectedBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
      inspectedAt: Date,
      condition: {
        type: String,
        enum: ["GOOD", "DAMAGED", "USED", "INCOMPLETE"],
      },
      notes: String,
      images: [String],
    },

    // Refund details
    refund: {
      amount: Number,
      method: {
        type: String,
        enum: ["ORIGINAL_PAYMENT", "STORE_CREDIT", "BANK_TRANSFER"],
      },
      status: {
        type: String,
        enum: ["PENDING", "PROCESSING", "COMPLETED", "FAILED"],
      },
      transactionId: String,
      processedAt: Date,
      completedAt: Date,
    },

    // Timeline tracking
    timeline: [
      {
        status: String,
        timestamp: {
          type: Date,
          default: Date.now,
        },
        notes: String,
        updatedBy: {
          type: Schema.Types.ObjectId,
          ref: "User",
        },
      },
    ],

    // Return window
    returnEligibleUntil: Date,
    returnRequestedAt: {
      type: Date,
      default: Date.now,
    },

    // Cancellation
    cancellationReason: String,
    cancelledBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    cancelledAt: Date,
  },
  {
    timestamps: true,
  }
);

// Indexes for performance
returnSchema.index({ userId: 1, status: 1 });
returnSchema.index({ orderId: 1 });
returnSchema.index({ shiprocketOrderId: 1 });
returnSchema.index({ status: 1, createdAt: -1 });

// Methods
returnSchema.methods.addTimelineEntry = function (status, notes, updatedBy) {
  this.timeline.push({
    status,
    notes,
    updatedBy,
    timestamp: new Date(),
  });
  this.status = status;
  return this.save();
};

returnSchema.methods.canBeCancelled = function () {
  const cancellableStatuses = ["REQUESTED", "APPROVED"];
  return cancellableStatuses.includes(this.status);
};

returnSchema.methods.isEligibleForReturn = function () {
  if (!this.returnEligibleUntil) return false;
  return new Date() <= this.returnEligibleUntil;
};

// Statics
returnSchema.statics.getReturnStats = async function (filters = {}) {
  const stats = await this.aggregate([
    { $match: filters },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        totalAmount: { $sum: "$refund.amount" },
      },
    },
  ]);
  return stats;
};

export const Return = mongoose.model("Return", returnSchema);
