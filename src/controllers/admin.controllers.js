import { User } from "../models/user.model.js";
import { Product } from "../models/product.models.js";
import { Order } from "../models/order.models.js";
import { response } from "express";

const orderlist = async (req, res) => {
        try {
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
                                                        productName:
                                                                "$productDetails.name",
                                                        productPrice:
                                                                "$productDetails.price",
                                                        productImage:
                                                                "$productDetails.ProductImage",
                                                        quantity: "$items.quantity",
                                                        username: "$userDetails.username",
                                                        email: "$userDetails.email",
                                                },
                                        },
                                        totalOrders: { $sum: 1 },
                                        totalAmount: {
                                                $sum: {
                                                        $multiply: [
                                                                "$items.quantity",
                                                                "$productDetails.price",
                                                        ],
                                                },
                                        },
                                },
                        },
                ]);
                res.status(200).json(orders);
        } catch (error) {
                res.status(500).json({ error: error.message });
        }
};

const userlist = async (req, res) => {
        try {
                const order = await User.aggregate([
                        {
                                $project: {
                                        username: 1,
                                        fullName: 1,
                                        email: 1,
                                },
                        },
                ]);
                res.status(200).json(order);
        } catch (error) {
                response.status(500).json({ error: error.message });
        }
};

const productList = async (req, res) => {
        try {
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
                res.status(200).json(products);
        } catch (error) {
                throw error;
        }
};

export { orderlist, userlist, productList };
