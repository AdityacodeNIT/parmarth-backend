import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Product } from "../models/Product.models.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

const addProduct = asyncHandler(async (req, res) => {
  const { name, price, description, Category } = req.body;

  if ([name, price].some((feild) => feild.trim === "")) {
    throw new ApiError(401, "all feilds are comlusory");
  }
  const existedProduct = await Product.findOne({
    $or: [{ name }],
  });
  if (existedProduct) {
    throw new ApiError(409, "Product Already exist");
  }

  const ProductImagelocalPath = req.file?.path;

  if (!ProductImagelocalPath) {
    throw new ApiError(400, "product Image is required");
  }
  const ProductImage = await uploadOnCloudinary(ProductImagelocalPath);
  if (!ProductImage) {
    throw new ApiError(400, "Product is needed");
  }
  const product = await Product.create({
    name,
    price,
    description,
    Category,
    ProductImage: ProductImage.url,
  });
  return res
    .status(201)
    .json(new ApiResponse(200, product, "Product added  succesfully"));
});

const getProduct = asyncHandler(async (req, res) => {
  const product = await Product.find();

  if (!product) {
    throw new ApiError(404, "Product does not found ");
  } else {
    res.json(product);
  }
});

const FillingProduct = asyncHandler(async (req, res) => {
  const product = await Product.find({ Category: "Filling" });

  if (!product) {
    throw new ApiError(404, "Product does not found ");
  } else {
    res.json(product);
  }
});
const ReusableProduct = asyncHandler(async (req, res) => {
  const product = await Product.find({ Category: "Reusable" });

  if (!product) {
    throw new ApiError(404, "Product does not found ");
  } else {
    res.json(product);
  }
});
const WritingProduct = asyncHandler(async (req, res) => {
  const product = await Product.find({ Category: "Writing" });

  if (!product) {
    throw new ApiError(404, "Product does not found ");
  } else {
    res.json(product);
  }
});
const PaperProduct = asyncHandler(async (req, res) => {
  const product = await Product.find({ Category: "Paper" });

  if (!product) {
    throw new ApiError(404, "Product does not found ");
  } else {
    res.json(product);
  }
});

const DeskSupplies = asyncHandler(async (req, res) => {
  const product = await Product.find({ Category: "DeskSupplies" });

  if (!product) {
    throw new ApiError(404, "Product does not found ");
  } else {
    res.json(product);
  }
});

export {
  addProduct,
  WritingProduct,
  DeskSupplies,
  PaperProduct,
  FillingProduct,
  ReusableProduct,
  getProduct,
};
