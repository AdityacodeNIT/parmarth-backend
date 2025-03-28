import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Product } from "../models/product.models.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import detectObjects from "../utils/detect.object.js";
import fs from "fs";



const addProduct = asyncHandler(async (req, res) => {
    const { name, price, description, Category, stocks, ...optionalFields } = req.body;

    // Validate required fields
    if (!name?.trim() || !price) {
        throw new ApiError(400, "Name and Price are required.");
    }

    // Check if product already exists
    const existedProduct = await Product.findOne({ name });
    if (existedProduct) {
        throw new ApiError(409, "Product already exists.");
    }

    // Check for product image from multer
    const ProductImagelocalPath = req.file?.path;
    if (!ProductImagelocalPath) {
        throw new ApiError(400, "Product image is required.");
    }

    // Upload image to Cloudinary
    const uploadedImage = await uploadOnCloudinary(ProductImagelocalPath);
    if (!uploadedImage) {
        throw new ApiError(400, "Failed to upload product image.");
    }

    // Prepare product object (Always include required fields)
    const productData = {
        name,
        price,
        description,
        Category,
        ProductImage: uploadedImage.url,
        stocks,
        seller: req.user._id,
    };

    // Assign only the optional fields that exist in the request
    Object.keys(optionalFields).forEach((key) => {
        if (optionalFields[key] !== undefined) {
            productData[key] = optionalFields[key];
        }
    });

    // Save product to database
    const product = await Product.create(productData);

    return res.status(201).json(new ApiResponse(201, product, "Product added successfully."));
});



const searchresult = asyncHandler(async (req, res) => {
        const { name } = req.body;

        const result = await Product.aggregate([
                {
                        $match: {
                                name: { 
                                        $regex: name,
                                        $options: "i",
                                        
                                },
                        },
                },
        ]);

        return res.json({ result });
});




export const searchByImage = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No image uploaded" });

        // Read the uploaded image
        const imageBuffer = fs.readFileSync(req.file.path);

        // **AI Detects Objects in Image**
        const detectedObjects = await detectObjects(imageBuffer);

        // **Find Matching Products in MongoDB**
        let foundProducts = [];
        for (const obj of detectedObjects) {
            const products = await Product.find({ category: obj.label }); // Match category
            foundProducts = [...foundProducts, ...products];
        }

        res.json({ products: foundProducts });

    } catch (error) {
        console.error("Error in AI Image Search:", error);
        res.status(500).json({ error: "Server Error" });
    }
};


const getProduct = asyncHandler(async (req, res) => {
        const product = await Product.find().sort({ createdAt: -1 });

        if (!product) {
                throw new ApiError(404, "Product does not found ");
        } else {
                res.json(product);
        }
});

const FillingProduct = asyncHandler(async (req, res) => {
        const product = await Product.find({ Category: "Filling" }).sort({ createdAt: -1 });;

        if (!product) {
                throw new ApiError(404, "Product does not found ");
        } else {
                res.json(product);
        }
});
const ReusableProduct = asyncHandler(async (req, res) => {
        const product = await Product.find({ Category: "Reusable" }).sort({ createdAt: -1 });;

        if (!product) {
                throw new ApiError(404, "Product does not found ");
        } else {
                res.json(product);
        }
});
const WritingProduct = asyncHandler(async (req, res) => {
        const product = await Product.find({ Category: "Writing" }).sort({ createdAt: -1 });;

        if (!product) {
                throw new ApiError(404, "Product does not found ");
        } else {
                res.json(product);
        }
});
const PaperProduct = asyncHandler(async (req, res) => {
        const product = await Product.find({ Category: "Paper" }).sort({ createdAt: -1 });;

        if (!product) {
                throw new ApiError(404, "Product does not found ");
        } else {
                res.json(product);
        }
});

const DeskSupplies = asyncHandler(async (req, res) => {
        const product = await Product.find({ Category: "DeskSupplies" }).sort({ createdAt: -1 });;

        if (!product) {
                throw new ApiError(404, "Product does not found ");
        } else {
                res.json(product);
        }
});

const getTrendingProduct=asyncHandler(async(req,res)=>{
        const products = await Product.aggregate([
                { $sort: { bought: -1 } },  
                { $limit: 5 }              
              ]);
              if (!products) {
                throw new ApiError(404, "Product does not found ");
        } else {
                res.json(products);
        }
})


const updateProduct = asyncHandler(async (req, res) => {
        try {
            if (req.user.role !== "seller" && req.user.role !== "superadmin") {
                return res.status(403).json({ error: "Permission denied" });
            }
            const { id } = req.params;
    
            // Ensure sellers update only their own products
            const filter = req.user.role === "seller" ? { _id: id, seller: req.user._id } : { _id: id };
            
            // Find the existing product
            const existingProduct = await Product.findOne(filter);
            if (!existingProduct) {
                return res.status(404).json({ message: "Product not found or unauthorized" });
            }
    
            // Prepare update data
            const updateData = {
                name: req.body.name || existingProduct.name,
                description: req.body.description || existingProduct.description,
                price: req.body.price || existingProduct.price,
                category: req.body.category || existingProduct.category
            };

            const avatarlocalPath = req.file?.path;

        

            
                    let uploadedAvatar;
                    try {
                        uploadedAvatar = await uploadOnCloudinary(avatarlocalPath);
                } catch (error) {
                        console.error("Error uploading avatar:", error);
                        throw new ApiError(500, "Error uploading avatar");
                }

            if (uploadedAvatar) {
                updateData.ProductImage = uploadedAvatar.url;
            } else {
                updateData.ProductImage = existingProduct.ProductImage; // Keep old image if not provided
            }
    
            // Update product while keeping old values for fields not sent in req.body
            const updatedProduct = await Product.findByIdAndUpdate(id, updateData, { new: true });
    
            res.json(updatedProduct);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: "Error updating product" });
        }
    });
    

    const deleteProduct = asyncHandler(async (req, res) => {
        try {
            // Only allow sellers to delete their own products or admins to delete any product
            if (req.user.role !== "seller" && req.user.role !== "superadmin") {
                return res.status(403).json({ error: "Permission denied" });
            }
    
            const { id } = req.params;
            
            // If the user is a seller, ensure they own the product
            const filter = req.user.role === "seller" ? { _id: id, seller: req.user._id } : { _id: id };
    
            const product = await Product.findOneAndDelete(filter);
    
            if (!product) {
                return res.status(404).json({ message: "Product not found or unauthorized" });
            }
    
            res.json({ message: "Product deleted successfully" });
        } catch (error) {
            res.status(500).json({ error: "Error deleting product" });
        }
    });

    const getSellerProduct = asyncHandler(async (req, res) => {
        if (req.user.role !== "seller" && req.user.role !== "superadmin") {
                return res.status(403).json({ error: "Permission denied" });

            }
            const filter = req.user.role === "seller" ? { seller:req.user._id} : {};
    

        const product = await Product.find(filter);

        if (!product) {
                throw new ApiError(404, "Product does not found ");
        } else {
                res.json(product);
        }
});
    


export {
        getTrendingProduct,
        addProduct,
        WritingProduct,
        DeskSupplies,
        PaperProduct,
        FillingProduct,
        ReusableProduct,
        getProduct,
        searchresult,
        deleteProduct,
        updateProduct,
        getSellerProduct,
};
