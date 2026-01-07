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
  energy: {
    calories: {
      type: Number,
      default: 0,
    },
  },

  macros: {
    protein: {
      type: Number,
      default: 0, // g
    },
    carbs: {
      type: Number,
      default: 0, // g
    },
    sugar: {
      type: Number,
      default: 0, // g (sub-carb)
    },
    fat: {
      type: Number,
      default: 0, // g
    },
    fibre: {
      type: Number,
      default: 0, // g
    },
  },

  micros: {
    vitamins: {
      vitaminA: {
        type: Number,
        default: 0, // %
      },
      vitaminB12: {
        type: Number,
        default: 0, // %
      },
      vitaminC: {
        type: Number,
        default: 0, // %
      },
      vitaminD: {
        type: Number,
        default: 0, // %
      },
      vitaminE: {
        type: Number,
        default: 0, // %
      },
      vitaminK: {
        type: Number,
        default: 0, // %
      },
    },

    minerals: {
      sodium: {
        type: Number,
        default: 0, // mg
      },
      calcium: {
        type: Number,
        default: 0, // %
      },
      iron: {
        type: Number,
        default: 0, // %
      },
      potassium: {
        type: Number,
        default: 0, // %
      },
      magnesium: {
        type: Number,
        default: 0, // %
      },
      zinc: {
        type: Number,
        default: 0, // %
      },
    },
  },
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
    allergens: [String], 

    /* ───────── Food Metadata ───────── */
    foodInfo: {
      shelfLife: String,         
      expiryDate: Date,
      storageInstructions: String, 
      servingSize: String,
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

    aiInsights: {
  whyHealthy: {
    text: String,
    generatedAt: Date,
    nutritionHash: String, // to detect changes
  },
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
