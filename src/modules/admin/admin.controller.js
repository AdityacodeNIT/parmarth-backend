import { User } from "../user/user.model.js";
import { Product } from "../product/product.models.js";
import { Order } from "../order/order.models.js";
import { Seller } from "../seller/seller.model.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { ApiError } from "../../utils/ApiError.js";


// ─────────────────────────── DASHBOARD STATS ───────────────────────────
export const getDashboardStats = asyncHandler(async (req, res) => {
  // Get counts
  const totalUsers = await User.countDocuments();
  const totalProducts = await Product.countDocuments();
  const totalOrders = await Order.countDocuments();
  const pendingSellers = await Seller.countDocuments({ approved: false });
  const approvedSellers = await Seller.countDocuments({ approved: true });
  const pendingProducts = await Product.countDocuments({ isApproved: false });

  // Calculate total revenue
  const orders = await Order.find({ status: { $in: ["delivered", "completed"] } });
  const totalRevenue = orders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);

  // Get growth metrics (compare with last month)
  const lastMonth = new Date();
  lastMonth.setMonth(lastMonth.getMonth() - 1);

  const usersLastMonth = await User.countDocuments({ createdAt: { $lt: lastMonth } });
  const userGrowth = usersLastMonth > 0 
    ? ((totalUsers - usersLastMonth) / usersLastMonth * 100).toFixed(1)
    : 0;

  const ordersLastMonth = await Order.find({
    createdAt: { $lt: lastMonth },
    status: { $in: ["delivered", "completed"] }
  });
  const revenueLastMonth = ordersLastMonth.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
  const revenueGrowth = revenueLastMonth > 0
    ? ((totalRevenue - revenueLastMonth) / revenueLastMonth * 100).toFixed(1)
    : 0;

  res.status(200).json(
    new ApiResponse(200, {
      totalUsers,
      totalProducts,
      totalOrders,
      totalRevenue,
      pendingSellers,
      approvedSellers,
      pendingProducts,
      userGrowth: parseFloat(userGrowth),
      revenueGrowth: parseFloat(revenueGrowth),
    }, "Dashboard stats fetched successfully")
  );
});


// ─────────────────────────── ORDERS (ADMIN VIEW) ───────────────────────────
export const orderlist = asyncHandler(async (req, res) => {
  const orders = await Order.find()
    .populate("userId", "username email")
    .populate("items.product", "name price")
    .populate("items.seller", "businessName");

  res.status(200).json(
    new ApiResponse(200, orders, "Orders fetched successfully")
  );
});


// ─────────────────────────── USERS LIST ───────────────────────────
export const userlist = asyncHandler(async (req, res) => {
  const users = await User.find().select(
    "username fullName email role createdAt"
  );

  res.status(200).json(
    new ApiResponse(200, users, "Users fetched successfully")
  );
});


// ─────────────────────────── PRODUCTS (ADMIN VIEW) ───────────────────────────
export const productList = asyncHandler(async (req, res) => {
  const { status } = req.query;

  let filter = {};
  if (status === "approved") filter.isApproved = true;
  if (status === "pending") filter.isApproved = false;

  const products = await Product.find(filter)
    .populate("seller", "businessName email")
    .select("name price category stock isApproved createdAt");

  res.status(200).json(
    new ApiResponse(200, products, "Products fetched successfully")
  );
});


// ─────────────────────────── PRODUCT APPROVAL ───────────────────────────
export const updateProductApproval = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { isApproved } = req.body;

  const product = await Product.findById(id);
  if (!product) throw new ApiError(404, "Product not found");

  product.isApproved = isApproved;
  await product.save();

  res.status(200).json(
    new ApiResponse(
      200,
      product,
      isApproved ? "Product approved" : "Product approval revoked"
    )
  );
});


// ─────────────────────────── DELETE USER ───────────────────────────
export const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, "User not found");
  if (user.role === "superadmin")
    throw new ApiError(403, "Cannot delete superadmin");

  await User.findByIdAndDelete(req.params.id);

  res.status(200).json(
    new ApiResponse(200, {}, "User deleted successfully")
  );
});


// ─────────────────────────── UPDATE USER ROLE ───────────────────────────
export const updateUserRole = asyncHandler(async (req, res) => {
  const { role } = req.body;

  if (!["customer", "seller", "admin", "superadmin"].includes(role)) {
    throw new ApiError(400, "Invalid role");
  }

  const user = await User.findByIdAndUpdate(
    req.params.id,
    { role },
    { new: true }
  );

  if (!user) throw new ApiError(404, "User not found");

  res.status(200).json(
    new ApiResponse(200, user, `Role updated to ${role}`)
  );
});


// ─────────────────────────── SELLER MANAGEMENT ───────────────────────────

export const getAllSellers = asyncHandler(async (req, res) => {
  console.log("Fetching all sellers with filters");
  console.log("Query Params:", req.query);
  const { status, search } = req.query;

  console.log("Status:", status);


  //  Pagination
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  //  Status validation
  const validStatuses = ["approved", "pending"];
  let filter = {};

  if (status) {
    if (!validStatuses.includes(status)) {
      return res
        .status(400)
        .json(new ApiResponse(400, null, "Invalid status value"));
    }

    filter.approved = status === "approved";
  }

  //  Search filter
  if (search) {
    filter.$or = [
      { fullName: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { businessName: { $regex: search, $options: "i" } },
    ];
  }

  //  DB Query

  console.log("Filter applied:", filter);
  const sellers = await Seller.find(filter)
    .select(
      "fullName email businessName gstNumber approved storeStatus createdAt"
    )
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await Seller.countDocuments(filter);

  //  Response
  res.status(200).json(
    new ApiResponse(
      200,
      {
        sellers,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
      "Sellers fetched successfully"
    )
  );
});



// Get single seller
export const getSellerById = asyncHandler(async (req, res) => {
  const seller = await Seller.findById(req.params.id)
    .select("-password -refreshToken");

  if (!seller) throw new ApiError(404, "Seller not found");

  res.status(200).json(
    new ApiResponse(200, seller, "Seller details fetched successfully")
  );
});


export const updateSellerApproval = asyncHandler(async (req, res) => {
  const { approved } = req.body;

  const seller = await Seller.findById(req.params.id);
  if (!seller) throw new ApiError(404, "Seller not found");

  seller.approved = approved;
  seller.storeStatus = approved ? "active" : "suspended";
  await seller.save();

  res.status(200).json(
    new ApiResponse(
      200,
      seller,
      approved ? "Seller approved" : "Seller suspended"
    )
  );
});


// Delete seller
export const deleteSeller = asyncHandler(async (req, res) => {
  console.log(req.params.id);

  const seller = await Seller.findById(req.params.id);
  console.log(seller);
  if (!seller) throw new ApiError(404, "Seller not found");

  await Seller.findByIdAndDelete(req.params.id);

  res.status(200).json(
    new ApiResponse(200, {}, "Seller deleted successfully")
  );
});
