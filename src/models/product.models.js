import mongoose, { Schema } from "mongoose";

const ProductSchema = new Schema(
  {
    /* ───────── Core Info ───────── */
    name: {
      type: String,
      required: true,
      index: "text",
    },

    price: {
      type: Number,
      required: true,
      index: true,
    },

    originalPrice: {
      type: Number,
      default: function () {
        return this.price;
      },
    },

    discount: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    description: {
      type: String,
      index: "text",
    },

    ProductImage: {
      type: String,
      required: true,
    },

    images: [String],

    /* ───────── Category ───────── */
    Category: {
      type: String,
      enum: [
        "Healthy Snacks",
        "Beverages",
        "Low Sugar Choices",
        "High Fibre Foods",
        "Daily Essentials",
      ],
      required: true,
      index: true,
    },

    subcategory: {
      type: String,
      index: true,
    },

    brand: {
      type: String,
      index: true,
    },

    /* ───────── Inventory ───────── */
    stocks: {
      type: Number,
      required: true,
      min: 0,
    },

    inStock: {
      type: Boolean,
      default: function () {
        return this.stocks > 0;
      },
      index: true,
    },

    lowStockThreshold: {
      type: Number,
      default: 10,
    },

    /* ───────── Nutrition (CRITICAL) ───────── */
    nutrition: {
      calories: Number,
      protein: Number, // grams
      carbs: Number,   // grams
      sugar: Number,   // grams
      fat: Number,     // grams
      fibre: Number,  // grams
      sodium: Number, // mg
    },

    /* ───────── Dietary Flags ───────── */
    dietary: {
      isVegan: Boolean,
      isVegetarian: Boolean,
      isGlutenFree: Boolean,
      isKetoFriendly: Boolean,
      isOrganic: Boolean,
      isSugarFree: Boolean,
    },

    /* ───────── Ingredients & Safety ───────── */
    ingredients: [String],
    allergens: [String], // e.g. ["nuts", "soy", "dairy"]

    /* ───────── Food Metadata ───────── */
    foodInfo: {
      shelfLife: String,            // "6 months"
      expiryDate: Date,
      storageInstructions: String,  // "Store in a cool, dry place"
      servingSize: String,          // "30g"
      servingsPerPack: Number,
    },

    /* ───────── Search & SEO ───────── */
    tags: [
      {
        type: String,
        index: "text",
      },
    ],

    searchKeywords: {
      type: String,
      index: "text",
    },

    seoTitle: String,
    seoDescription: String,

    slug: {
      type: String,
      unique: true,
      sparse: true,
    },

    /* ───────── Ratings & Analytics ───────── */
    rating: {
      type: Number,
      default: 0,
      min: 0,
      index: true,
    },

    reviewCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    viewCount: {
      type: Number,
      default: 0,
    },

    salesCount: {
      type: Number,
      default: 0,
    },

    popularity: {
      type: Number,
      default: 0,
      index: true,
    },

    /* ───────── Seller ───────── */
    seller: {
      type: Schema.Types.ObjectId,
      ref: "user",
      required: true,
      index: true,
    },

    sellerName: String,

    /* ───────── Status ───────── */
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    isFeatured: {
      type: Boolean,
      default: false,
    },

    /* ───────── Pricing History ───────── */
    priceHistory: [
      {
        price: Number,
        date: { type: Date, default: Date.now },
      },
    ],

    /* ───────── Flexible Attributes ───────── */
    attributes: [
      {
        name: { type: String, required: true },
        value: { type: String, required: true },
      },
    ],
  },
  {
    timestamps: true,
  }
);

/* ───────── Indexes ───────── */
ProductSchema.index({
  name: "text",
  description: "text",
  Category: "text",
  subcategory: "text",
  brand: "text",
  tags: "text",
  searchKeywords: "text",
}, {
  weights: {
    name: 10,
    tags: 5,
    Category: 3,
    brand: 3,
    description: 1,
    searchKeywords: 2,
  },
});

ProductSchema.index({ Category: 1, price: 1 });
ProductSchema.index({ Category: 1, rating: -1 });
ProductSchema.index({ popularity: -1, rating: -1 });
ProductSchema.index({ "dietary.isVegan": 1 });
ProductSchema.index({ "nutrition.sugar": 1 });
ProductSchema.index({ "nutrition.protein": -1 });

/* ───────── Virtuals ───────── */
ProductSchema.virtual("discountedPrice").get(function () {
  return this.discount > 0
    ? this.price * (1 - this.discount / 100)
    : this.price;
});

ProductSchema.virtual("isLowStock").get(function () {
  return this.stocks <= this.lowStockThreshold;
});

/* ───────── Middleware ───────── */
ProductSchema.pre("save", function (next) {
  this.inStock = this.stocks > 0;

  if (!this.slug && this.name) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  this.searchKeywords = [
    this.name,
    this.description,
    this.Category,
    this.subcategory,
    this.brand,
    ...(this.tags || []),
  ]
    .filter(Boolean)
    .join(" ");

  this.popularity =
    this.rating * this.reviewCount * 0.3 +
    this.salesCount * 0.5 +
    this.viewCount * 0.2;

  next();
});

/* ───────── Methods ───────── */
ProductSchema.methods.incrementViewCount = function () {
  this.viewCount += 1;
  return this.save();
};

ProductSchema.methods.incrementSalesCount = function (qty = 1) {
  this.salesCount += qty;
  return this.save();
};

ProductSchema.methods.updateRating = function (rating, count) {
  this.rating = rating;
  this.reviewCount = count;
  return this.save();
};

/* ───────── Serialization ───────── */
ProductSchema.set("toJSON", { virtuals: true });
ProductSchema.set("toObject", { virtuals: true });

export const Product = mongoose.model("Product", ProductSchema);
