import mongoose, { Schema } from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

const sellerSchema = new Schema(
  {
    /* ───────────────────────────────
       Basic Info
    ─────────────────────────────── */
    username: {
      type: String,
      required: [true, "Username is required"],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    fullName: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
    },
    avatar: {
      type: String, // Cloudinary URL
      required: true,
    },
    coverImage: {
      type: String, // Optional Cloudinary URL
    },

    /* ───────────────────────────────
       Business Details
    ─────────────────────────────── */
    businessName: {
      type: String,
      required: [true, "Business name is required"],
      trim: true,
    },
    businessType: {
      type: String,
      required: [true, "Business type is required"],
      trim: true,
    },
    businessAddress: {
      type: String,
      required: [true, "Business address is required"],
      trim: true,
    },
    pincode: {
      type: String,
      required: [true, "Pincode is required"],
      trim: true,
    },
    contactNumber: {
      type: String,
      required: [true, "Contact number is required"],
      trim: true,
    },

    /* ───────────────────────────────
       Tax / Legal Details
    ─────────────────────────────── */
    gstNumber: {
      type: String,
      required: [true, "GST Number is required"],
      uppercase: true,
      trim: true,
    },
    panNumber: {
      type: String,
      required: [true, "PAN Number is required"],
      uppercase: true,
      trim: true,
    },
    

    /* ───────────────────────────────
       Bank Details
    ─────────────────────────────── */
    accountHolderName: {
      type: String,
      required: [true, "Account holder name is required"],
      trim: true,
    },
    accountNumber: {
      type: String,
      required: [true, "Account number is required"],
      trim: true,
    },
    ifscCode: {
      type: String,
      required: [true, "IFSC Code is required"],
      uppercase: true,
      trim: true,
    },
    bankName: {
      type: String,
      required: [true, "Bank name is required"],
      trim: true,
    },

    /* ───────────────────────────────
       Authentication
    ─────────────────────────────── */
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters long"],
    },
    refreshToken: {
      type: String,
      trim: true,
    },

    /* ───────────────────────────────
       Role & Approval
    ─────────────────────────────── */
    role: {
      type: String,
      enum: ["customer", "seller", "admin", "superadmin"],
      default: "seller",
    },
    approved: {
      type: Boolean,
      default: false, // Admin must approve before login
    },

    /* ───────────────────────────────
   Seller Store Meta
────────────────────────────── */
storeStatus: {
  type: String,
  enum: ["active", "suspended", "closed"],
  default: "active",
},
totalProducts: {
  type: Number,
  default: 0,
},
totalOrders: {
  type: Number,
  default: 0,
},

/* ───────────────────────────────
   Notification Settings
────────────────────────────── */
notifications: {
  lowStock: { type: Boolean, default: true },
  email: { type: Boolean, default: true },
},

lastLoginAt: {
  type: Date,
},



  },
  { timestamps: true }
);

sellerSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

sellerSchema.methods.isPasswordCorrect = async function (password) {
  return await bcrypt.compare(password, this.password);
};

/* ───────────────────────────────
   JWT Token Methods
────────────────────────────── */
sellerSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    {
      _id: this._id,
      email: this.email,
      username: this.username,
      fullName: this.fullName,
      role: this.role,
    },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRY }
  );
};

sellerSchema.methods.generateRefreshToken = function () {
  return jwt.sign(
    {
      _id: this._id,
      email: this.email,
    },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRY }
  );
};

export const Seller = mongoose.model("Seller", sellerSchema);
