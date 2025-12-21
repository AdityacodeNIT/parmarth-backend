import { User } from "../models/user.model.js";
import { Product } from "../models/product.models.js";
import { Order } from "../models/order.models.js";
import { Seller } from "../models/seller.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";


// ─────────────────────────── Orders List ───────────────────────────
const orderlist = asyncHandler(async (req, res) => {
  const orders = await Order.aggregate([
    { $unwind: "$items" },
    {
      $lookup: {
        from: "products", // Collection name for Product
        localField: "items.productId", // Field in Order referencing Product
        foreignField: "_id",
        as: "productDetails",
      },
    },
    { $unwind: "$productDetails" },
    {
      $lookup: {
        from: "users",
        localField: "userId", // Field in Order referencing User
        foreignField: "_id",
        as: "userDetails",
      },
    },
    { $unwind: "$userDetails" },
    {
      $group: {
        _id: "$status",
        orders: {
          $push: {
            productName: "$productDetails.name",
            productPrice: "$productDetails.price",
            productImage: "$productDetails.ProductImage",
            quantity: "$items.quantity",
            username: "$userDetails.username",
            email: "$userDetails.email",
          },
        },
        totalOrders: { $sum: 1 },
        totalAmount: {
          $sum: {
            $multiply: ["$items.quantity", "$productDetails.price"],
          },
        },
      },
    },
  ]);
  res.status(200).json(new ApiResponse(200, orders, "Orders fetched successfully"));
});


// ─────────────────────────── Users List ───────────────────────────
const userlist = asyncHandler(async (req, res) => {
  const users = await User.aggregate([
    {
      $project: {
        username: 1,
        fullName: 1,
        email: 1,
        role: 1,
      },
    },
  ]);
  res.status(200).json(new ApiResponse(200, users, "Users fetched successfully"));
});


// ─────────────────────────── Product List ───────────────────────────
const productList = asyncHandler(async (req, res) => {
  const products = await Product.aggregate([
    {
      $project: {
        name: 1,
        price: 1,
        Category: 1,
        stocks: 1,
      },
    },
  ]);
  res.status(200).json(new ApiResponse(200, products, "Products fetched successfully"));
});


// ─────────────────────────── Delete User ───────────────────────────
export const deleteUser = asyncHandler(async (req, res) => {
  const userId = req.params.id;
  const userToDelete = await User.findById(userId);

  if (!userToDelete) throw new ApiError(404, "User not found");
  if (userToDelete.role === "superadmin")
    throw new ApiError(403, "Cannot delete a superadmin");

  const deletedUser = await User.findByIdAndDelete(userId);
  res.status(200).json(new ApiResponse(200, deletedUser, "User deleted successfully"));
});


// ─────────────────────────── Update User Role ───────────────────────────
export const updateUserRole = asyncHandler(async (req, res) => {
  const userId = req.params.id;
  const newRole = req.body.role;

  if (!["customer", "seller", "admin", "superadmin"].includes(newRole)) {
    throw new ApiError(400, "Invalid role");
  }

  const user = await User.findByIdAndUpdate(userId, { role: newRole }, { new: true });
  if (!user) throw new ApiError(404, "User not found");

  res.status(200).json(new ApiResponse(200, user, `User promoted to ${newRole}`));
});


// ─────────────────────────── Manage Orders ───────────────────────────
export const manageOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find();
  res.status(200).json(new ApiResponse(200, orders, "Orders fetched successfully"));
});


// ─────────────────────────── Get Products by Role ───────────────────────────
export const getProducts = asyncHandler(async (req, res) => {
  let filter = req.user.role === "seller" ? { seller: req.user._id } : {};
  const products = await Product.find(filter);
  res.status(200).json(new ApiResponse(200, products, "Products fetched successfully"));
});


// ─────────────────────────── SELLER MANAGEMENT ───────────────────────────

// ✅ Get all sellers (optionally filter by approval status)
export const getAllSellers = asyncHandler(async (req, res) => {
  const { status } = req.query;

  let filter = {};
  if (status === "approved") filter.approved = true;
  if (status === "pending") filter.approved = false;

  const sellers = await Seller.find(filter).select(
    "fullName email username gstNumber businessName approved"
  );

  res
    .status(200)
    .json(new ApiResponse(200, sellers, "Sellers fetched successfully"));
});


// ✅ Get a single seller by ID (for detail view)
export const getSellerById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const seller = await Seller.findById(id).select("-password -refreshSessionToken");

  if (!seller) throw new ApiError(404, "Seller not found");

  res
    .status(200)
    .json(new ApiResponse(200, seller, "Seller details fetched successfully"));
});


// ✅ Approve or revoke seller approval
export const updateSellerApproval = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { approved } = req.body;

  const seller = await Seller.findById(id);
  if (!seller) throw new ApiError(404, "Seller not found");

  seller.approved = approved;
  await seller.save();

  res.status(200).json(
    new ApiResponse(
      200,
      seller,
      approved ? "Seller approved successfully" : "Seller approval revoked"
    )
  );
});


// ✅ Delete a seller
export const deleteSeller = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const seller = await Seller.findById(id);
  if (!seller) throw new ApiError(404, "Seller not found");

  await Seller.findByIdAndDelete(id);
  res.status(200).json(new ApiResponse(200, {}, "Seller deleted successfully"));
});


// ─────────────────────────── EXPORTS ───────────────────────────
export {
  orderlist,
  userlist,
  productList
};
