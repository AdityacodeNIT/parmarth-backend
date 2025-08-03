import { User } from "../models/user.model.js";
import { Product } from "../models/product.models.js";
import { Order } from "../models/order.models.js";
import { asyncHandler } from "../utils/asyncHandler.js";


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
        });

const userlist = asyncHandler(async (req, res) => {

                const order = await User.aggregate([
                        {
                                $project: {
                                        username: 1,
                                        fullName: 1,
                                        email: 1,
                                        role:1,
                                },
                        },
                ]);
                res.status(200).json(order);      
});

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
                res.status(200).json(products);
});

export const deleteUser = asyncHandler(async (req, res) => {
            const userId = req.params.id;
    
            // Find the user first
            const userToDelete = await User.findById(userId);
    
            if (!userToDelete) {
                return res.status(404).json({ message: "User not found" });
            }
    
            // Prevent deletion if the user is a superadmin
            if (userToDelete.role === "superadmin") {
                return res.status(403).json({ message: "Cannot delete a superadmin" });
            }
    
            // Delete the user
            const deletedUser = await User.findByIdAndDelete(userId);
    
            res.status(200).json({ message: "User deleted successfully", deletedUser });
    });
    
    export const updateUserRole = asyncHandler(async (req, res) => {
                const userId=req.params.id;
                const newRole=req.body.role;
     
    
            if (!["customer", "seller", "admin", "superadmin"].includes(newRole)) {
                return res.status(400).json({ error: "Invalid role" });
            }
    
            const user = await User.findByIdAndUpdate(userId, { role: newRole }, { new: true });
    
            if (!user) return res.status(404).json({ error: "User not found" });
    
            res.json({ message: `User promoted to ${newRole}`, user }); 
    });

    export const manageOrders = asyncHandler(async (req, res) => {
        
            const orders = await Order.find();
            res.json(orders);
        });


    export const getProducts = asyncHandler(async (req, res) => {
   
            let filter = req.user.role === "seller" ? { seller: req.user._id } : {}; 
            const products = await Product.find(filter);
            res.json(products);
        
    });
    

    


    
    

export { orderlist, userlist, productList};
