import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { Product } from '../models/product.models.js';
import { uploadOnCloudinary } from '../utils/cloudinary.js';
import detectObjects from '../utils/detect.object.js';
import fs from 'fs';

const addProduct = asyncHandler(async (req, res) => {
  const {
    name,
    price,
    originalPrice,
    description,
    Category,
    subcategory,
    brand,
    stocks,

    ingredients,
    allergens,
    tags,

    nutrition,
    dietary,
    foodInfo,

    seoTitle,
    seoDescription,
    isFeatured,
    attributes,
  } = req.body;

  /* ───────── Validation ───────── */
  if (!name?.trim() || !price || !Category || stocks === undefined) {
    throw new ApiError(400, "Name, price, category and stocks are required");
  }

  const exists = await Product.findOne({ name: name.trim() });
  if (exists) {
    throw new ApiError(409, "Product already exists");
  }

  /* ───────── Image Validation ───────── */
  const mainImageFile = req.files?.productImage?.[0];
  if (!mainImageFile?.path) {
    throw new ApiError(400, "Primary product image is required");
  }

  /* ───────── Upload Primary Image ───────── */
  const uploadedMainImage = await uploadOnCloudinary(mainImageFile.path);
  if (!uploadedMainImage?.url) {
    throw new ApiError(500, "Primary image upload failed");
  }

  /* ───────── Upload Gallery Images ───────── */
  let galleryImages = [];
  if (req.files?.images?.length) {
    const uploads = await Promise.all(
      req.files.images.map((file) => uploadOnCloudinary(file.path))
    );

    galleryImages = uploads
      .filter((img) => img?.url)
      .map((img) => img.url);
  }

  /* ───────── Helpers ───────── */
  const parseJSON = (val) => {
    try {
      return typeof val === "string" ? JSON.parse(val) : val;
    } catch {
      return undefined;
    }
  };

  const normalizeArray = (val) =>
    Array.isArray(val)
      ? val
      : typeof val === "string"
      ? val.split(",").map((v) => v.trim()).filter(Boolean)
      : [];

  const num = (v) => (v === undefined || v === null ? 0 : Number(v));

  /* ───────── Pricing Logic ───────── */
  const basePrice = Number(price);
  const baseOriginalPrice = originalPrice || basePrice;

  const discount =
    baseOriginalPrice > basePrice
      ? Math.round(
          ((baseOriginalPrice - basePrice) / baseOriginalPrice) * 100
        )
      : 0;

  /* ───────── Nutrition Normalization (NEW) ───────── */
  const rawNutrition = parseJSON(nutrition) || {};

  const normalizedNutrition = {
    energy: {
      calories: num(rawNutrition?.energy?.calories),
    },

    macros: {
      protein: num(rawNutrition?.macros?.protein),
      carbs: num(rawNutrition?.macros?.carbs),
      sugar: num(rawNutrition?.macros?.sugar),
      fat: num(rawNutrition?.macros?.fat),
      fibre: num(rawNutrition?.macros?.fibre),
    },

    micros: {
      vitamins: {
        vitaminA: num(rawNutrition?.micros?.vitamins?.vitaminA),
        vitaminB12: num(rawNutrition?.micros?.vitamins?.vitaminB12),
        vitaminC: num(rawNutrition?.micros?.vitamins?.vitaminC),
        vitaminD: num(rawNutrition?.micros?.vitamins?.vitaminD),
        vitaminE: num(rawNutrition?.micros?.vitamins?.vitaminE),
        vitaminK: num(rawNutrition?.micros?.vitamins?.vitaminK),
      },
      minerals: {
        sodium: num(rawNutrition?.micros?.minerals?.sodium),
        calcium: num(rawNutrition?.micros?.minerals?.calcium),
        iron: num(rawNutrition?.micros?.minerals?.iron),
        potassium: num(rawNutrition?.micros?.minerals?.potassium),
        magnesium: num(rawNutrition?.micros?.minerals?.magnesium),
        zinc: num(rawNutrition?.micros?.minerals?.zinc),
      },
    },
  };

  /* ───────── Product Object ───────── */
  const productData = {
    name: name.trim(),
    price: basePrice,
    originalPrice: baseOriginalPrice,
    discount,

    description,
    Category,
    subcategory,
    brand,

    stocks,

    ProductImage: uploadedMainImage.url,
    images: galleryImages,

    seller: req.user._id,
    sellerName: req.user.fullName,

    ingredients: normalizeArray(ingredients),
    allergens: normalizeArray(allergens),
    tags: normalizeArray(tags),

    nutrition: normalizedNutrition,
    dietary: parseJSON(dietary),
    foodInfo: parseJSON(foodInfo),

    seoTitle,
    seoDescription,
    isFeatured: Boolean(isFeatured),

    attributes: parseJSON(attributes),

    priceHistory: [{ price: basePrice }],
  };

  const product = await Product.create(productData);

  return res.status(201).json(
    new ApiResponse(201, product, "Product added successfully")
  );
});



const searchresult = asyncHandler(async (req, res) => {
  const { name } = req.body;
    console.log(name);

  const result = await Product.aggregate([
    {
      $match: {
        name: {
          $regex: name,
          $options: 'i'
        }
      }
    }
  ]);
  console.log(result)

  return res.status(200)
  .json(result );
});

export const searchByImage = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image uploaded' });

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
    console.error('Error in AI Image Search:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

const getProducts = asyncHandler(async (req, res) => {
  try {
    const { category } = req.query;
  
    let filter = {};
 
    if (category) {
  filter.Category = category;
}
    const products = await Product.find(filter).select("name price ProductImage rating reviewCount Category").lean();

    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({
      message: 'Failed to fetch products',
      error: error.message
    });
  }
});

// GET /api/v1/product/:id
const getProductById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const product = await Product.findById(id).lean();

  if (!product) {
    return res.status(404).json({ message: "Product not found" });
  }

  res.status(200).json(product);
});

const getTrendingProduct = asyncHandler(async (req, res) => {
  const products = await Product.aggregate(
    [{
         $sort: { bought: -1 } },
        { $limit: 5 }]);
  if (!products) {
    throw new ApiError(404, 'Product does not found ');
  } else {
    res.json(products);
  }
});


const updateProduct = asyncHandler(async (req, res) => {
  try {
    if (req.user.role !== 'seller' && req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Permission denied' });
    }
    const { id } = req.params;

    // Ensure sellers update only their own products
    const filter = req.user.role === 'seller' ? { _id: id, seller: req.user._id } : { _id: id };

    // Find the existing product
    const existingProduct = await Product.findOne(filter);
    if (!existingProduct) {
      return res.status(404).json({ message: 'Product not found or unauthorized' });
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
      console.error('Error uploading avatar:', error);
      throw new ApiError(500, 'Error uploading avatar');
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
    res.status(500).json({ error: 'Error updating product' });
  }
});

const deleteProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Sellers can delete only their own products
  const filter =
    req.user.role === "seller"
      ? { _id: id, seller: req.user._id }
      : { _id: id };

  const product = await Product.findOneAndDelete(filter);

  if (!product) {
    return res.status(404).json({
      success: false,
      message: "Product not found or not authorized to delete",
    });
  }

  return res.status(200).json({
    success: true,
    deletedId: id,
    message: "Product deleted successfully",
  });
});


const getSellerProduct = asyncHandler(async (req, res) => {
  if (req.user.role !== 'seller' && req.user.role !== 'superadmin') {
    return res.status(403).json({ error: 'Permission denied' });
  }
  const filter = req.user.role === 'seller' ? { seller: req.user._id } : {};

  const product = await Product.find(filter);

  if (!product) {
    throw new ApiError(404, 'Product does not found ');
  } else {
    res.json(product);
  }
});

export {
  getTrendingProduct,
  addProduct,
  getProducts,
  searchresult,
  deleteProduct,
  updateProduct,
  getSellerProduct,
  getProductById
};
