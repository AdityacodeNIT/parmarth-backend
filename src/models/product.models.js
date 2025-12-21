import mongoose, { Schema } from "mongoose";

const ProductSchema = new Schema(
    {
        name: { 
            type: String, 
            required: true,
            index: 'text'
        },
        price: { 
            type: Number, 
            required: true,
            index: true
        },
        originalPrice: {
            type: Number,
            default: function() { return this.price; }
        },
        discount: {
            type: Number,
            default: 0,
            min: 0,
            max: 100
        },
        description: { 
            type: String,
            index: 'text'
        },
        ProductImage: { 
            type: String, 
            required: true 
        },
        images: [{
            type: String
        }],
        Category: {
            type: String,
            enum: [
                "Writing",        // Pens, Markers, Stylus
                "Paper",          // Notebooks, Sticky Notes, Recycled Paper
                "DeskSupplies",   // Calculators, Digital Notepads, Pen Holders
                "Filing",         // Folders, Binders, Files
                "Reusable",       // Smart Notebooks, Erasable Pens
                "TechStationery", // Digital writing pads, Smart Pens, E-Ink Tablets
            ],
            required: true,
            index: true
        },
        subcategory: {
            type: String,
            index: true
        },
        brand: {
            type: String,
            index: true
        },
        stocks: { 
            type: Number, 
            required: true,
            min: 0
        },
        inStock: {
            type: Boolean,
            default: function() { return this.stocks > 0; }
        },
        
        // Search and SEO fields
        tags: [{
            type: String,
            index: 'text'
        }],
        searchKeywords: {
            type: String,
            index: 'text'
        },
        seoTitle: String,
        seoDescription: String,
        slug: {
            type: String,
            unique: true,
            sparse: true
        },

        // Rating and reviews
        rating: {
            type: Number,
            default: 0,
            min: 0,
            index: true
        },
        reviewCount: {
            type: Number,
            default: 0,
            min: 0
        },
        
        // Analytics fields
        viewCount: {
            type: Number,
            default: 0
        },
        salesCount: {
            type: Number,
            default: 0
        },
        popularity: {
            type: Number,
            default: 0,
            index: true
        },

        // **Physical Attributes**
        length: { type: Number }, 
        breadth: { type: Number }, 
        height: { type: Number }, 
        weight: { type: Number }, 

        // **Tech-Related Attributes**
        memory: { type: String }, // Example: "16GB"
        batteryLife: { type: String }, // Example: "10 hours"
        screenSize: { type: String }, // Example: "7-inch"
        connectivity: { type: String }, // Example: "Bluetooth, USB-C"
        material: { type: String }, // Example: "Plastic, Metal, Recycled Paper"

        // **Writing-Specific Attributes**
        inkColor: { type: String }, // Example: "Blue, Black"
        refillable: { type: Boolean }, // Example: true/false

        // Dynamic attributes for flexible product properties
        attributes: [{
            name: { type: String, required: true },
            value: { type: String, required: true }
        }],

        // Product status
        isActive: {
            type: Boolean,
            default: true,
            index: true
        },
        isFeatured: {
            type: Boolean,
            default: false
        },
        
        seller: {
            type: Schema.Types.ObjectId,
            ref: "user",
            required: true,
            index: true
        },
        sellerName: String, // Denormalized for search performance
        
        // Inventory management
        lowStockThreshold: {
            type: Number,
            default: 10
        },
        
        // Pricing history for analytics
        priceHistory: [{
            price: Number,
            date: { type: Date, default: Date.now }
        }]
    },
    { 
        timestamps: true,
        // Add text index for full-text search
        indexes: [
            {
                name: 'text',
                description: 'text',
                'Category': 'text',
                tags: 'text',
                searchKeywords: 'text'
            }
        ]
    }
);

// Compound indexes for efficient querying
ProductSchema.index({ Category: 1, price: 1 });
ProductSchema.index({ Category: 1, rating: -1 });
ProductSchema.index({ seller: 1, isActive: 1 });
ProductSchema.index({ createdAt: -1 });
ProductSchema.index({ popularity: -1, rating: -1 });
ProductSchema.index({ inStock: 1, isActive: 1 });

// Text index for search
ProductSchema.index({
    name: 'text',
    description: 'text',
    Category: 'text',
    subcategory: 'text',
    brand: 'text',
    tags: 'text',
    searchKeywords: 'text'
}, {
    weights: {
        name: 10,
        tags: 5,
        Category: 3,
        subcategory: 3,
        brand: 3,
        description: 1,
        searchKeywords: 2
    }
});

// Virtual for computed fields
ProductSchema.virtual('discountedPrice').get(function() {
    if (this.discount > 0) {
        return this.price * (1 - this.discount / 100);
    }
    return this.price;
});

ProductSchema.virtual('isLowStock').get(function() {
    return this.stocks <= this.lowStockThreshold;
});

// Pre-save middleware
ProductSchema.pre('save', function(next) {
    // Update inStock status
    this.inStock = this.stocks > 0;
    
    // Generate slug if not provided
    if (!this.slug && this.name) {
        this.slug = this.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }
    
    // Update search keywords
    this.searchKeywords = [
        this.name,
        this.description,
        this.Category,
        this.subcategory,
        this.brand,
        ...(this.tags || [])
    ].filter(Boolean).join(' ');
    
    // Calculate popularity score
    this.popularity = (this.rating * this.reviewCount * 0.3) + 
                     (this.salesCount * 0.5) + 
                     (this.viewCount * 0.2);
    
    next();
});

// Post-save middleware to update search index


// Instance methods
ProductSchema.methods.incrementViewCount = function() {
    this.viewCount += 1;
    return this.save();
};

ProductSchema.methods.incrementSalesCount = function(quantity = 1) {
    this.salesCount += quantity;
    return this.save();
};

ProductSchema.methods.updateRating = function(newRating, reviewCount) {
    this.rating = newRating;
    this.reviewCount = reviewCount;
    return this.save();
};

ProductSchema.methods.updateStock = function(quantity) {
    this.stocks = Math.max(0, this.stocks + quantity);
    this.inStock = this.stocks > 0;
    return this.save();
};

// Static methods
ProductSchema.statics.findByCategory = function(category, options = {}) {
    const query = { Category: category, isActive: true };
    return this.find(query, null, options);
};

ProductSchema.statics.findLowStock = function() {
    return this.find({
        $expr: { $lte: ['$stocks', '$lowStockThreshold'] },
        isActive: true
    });
};

ProductSchema.statics.findPopular = function(limit = 10) {
    return this.find({ isActive: true })
        .sort({ popularity: -1, rating: -1 })
        .limit(limit);
};

ProductSchema.statics.findByPriceRange = function(minPrice, maxPrice) {
    return this.find({
        price: { $gte: minPrice, $lte: maxPrice },
        isActive: true
    });
};

// Ensure virtual fields are serialized
ProductSchema.set('toJSON', { virtuals: true });
ProductSchema.set('toObject', { virtuals: true });

export const Product = mongoose.model("Product", ProductSchema);