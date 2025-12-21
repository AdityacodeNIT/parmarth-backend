import mongoose from 'mongoose';
import logger from '../utils/logger.js';
import { Product } from '../models/product.models.js';

// Wishlist Item Schema
const WishlistItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  addedAt: {
    type: Date,
    default: Date.now
  },
  priority: {
    type: Number,
    default: 1,
    min: 1,
    max: 5
  },
  notes: {
    type: String,
    maxlength: 500
  },
  priceWhenAdded: {
    type: Number,
    required: true
  },
  notifyOnPriceChange: {
    type: Boolean,
    default: false
  },
  notifyOnStock: {
    type: Boolean,
    default: false
  }
});

// Wishlist Schema
const WishlistSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    default: 'My Wishlist'
  },
  description: {
    type: String,
    maxlength: 1000
  },
  items: [WishlistItemSchema],
  isPublic: {
    type: Boolean,
    default: false
  },
  shareToken: {
    type: String,
    unique: true,
    sparse: true
  },
  category: {
    type: String,
    enum: ['personal', 'gift', 'business', 'other'],
    default: 'personal'
  },
  tags: [{
    type: String,
    maxlength: 50
  }],
  totalItems: {
    type: Number,
    default: 0
  },
  totalValue: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes
WishlistSchema.index({ userId: 1, isActive: 1 });
WishlistSchema.index({ shareToken: 1 });
WishlistSchema.index({ isPublic: 1, isActive: 1 });
WishlistSchema.index({ 'items.productId': 1 });

// Pre-save middleware to calculate totals
WishlistSchema.pre('save', function(next) {
  this.totalItems = this.items.length;
  this.totalValue = this.items.reduce((sum, item) => sum + item.priceWhenAdded, 0);
  next();
});

// Methods
WishlistSchema.methods.addItem = function(productId, price, options = {}) {
  const existingItemIndex = this.items.findIndex(item => 
    item.productId.toString() === productId.toString()
  );

  if (existingItemIndex > -1) {
    // Update existing item
    const existingItem = this.items[existingItemIndex];
    existingItem.priority = options.priority || existingItem.priority;
    existingItem.notes = options.notes || existingItem.notes;
    existingItem.notifyOnPriceChange = options.notifyOnPriceChange !== undefined 
      ? options.notifyOnPriceChange 
      : existingItem.notifyOnPriceChange;
    existingItem.notifyOnStock = options.notifyOnStock !== undefined 
      ? options.notifyOnStock 
      : existingItem.notifyOnStock;
    return false; // Item already exists
  } else {
    // Add new item
    this.items.push({
      productId,
      priceWhenAdded: price,
      priority: options.priority || 1,
      notes: options.notes || '',
      notifyOnPriceChange: options.notifyOnPriceChange || false,
      notifyOnStock: options.notifyOnStock || false
    });
    return true; // New item added
  }
};

WishlistSchema.methods.removeItem = function(productId) {
  const initialLength = this.items.length;
  this.items = this.items.filter(item => 
    item.productId.toString() !== productId.toString()
  );
  return this.items.length < initialLength;
};

WishlistSchema.methods.generateShareToken = function() {
  this.shareToken = 'wl_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
  return this.shareToken;
};

const Wishlist = mongoose.model('Wishlist', WishlistSchema);

class WishlistService {
  // Get user's wishlists
  async getUserWishlists(userId, options = {}) {
    try {
      const {
        includeItems = true,
        category,
        limit = 20,
        skip = 0
      } = options;

      const query = { userId, isActive: true };
      if (category) {
        query.category = category;
      }

      let wishlists = await Wishlist.find(query)
        .sort({ updatedAt: -1 })
        .limit(limit)
        .skip(skip)
        .lean();

      if (includeItems) {
        wishlists = await Promise.all(
          wishlists.map(async (wishlist) => {
            if (wishlist.items && wishlist.items.length > 0) {
              const productIds = wishlist.items.map(item => item.productId);
              const products = await Product.find({ _id: { $in: productIds } })
                .select('name price ProductImage Category stocks inStock rating reviewCount')
                .lean();

              const productMap = new Map(products.map(p => [p._id.toString(), p]));

              wishlist.items = wishlist.items.map(item => ({
                ...item,
                product: productMap.get(item.productId.toString()),
                priceChange: productMap.get(item.productId.toString())?.price - item.priceWhenAdded || 0
              }));
            }
            return wishlist;
          })
        );
      }

      return wishlists;
    } catch (error) {
      logger.error('Failed to get user wishlists:', error);
      throw error;
    }
  }

  // Get specific wishlist
  async getWishlist(wishlistId, userId = null) {
    try {
      const query = { _id: wishlistId, isActive: true };
      if (userId) {
        query.userId = userId;
      }

      const wishlist = await Wishlist.findOne(query).lean();
      if (!wishlist) {
        throw new Error('Wishlist not found');
      }

      // Check if user has access to private wishlist
      if (!wishlist.isPublic && (!userId || wishlist.userId.toString() !== userId.toString())) {
        throw new Error('Access denied');
      }

      // Populate items with product details
      if (wishlist.items && wishlist.items.length > 0) {
        const productIds = wishlist.items.map(item => item.productId);
        const products = await Product.find({ _id: { $in: productIds } })
          .select('name price ProductImage Category stocks inStock rating reviewCount')
          .lean();

        const productMap = new Map(products.map(p => [p._id.toString(), p]));

        wishlist.items = wishlist.items.map(item => ({
          ...item,
          product: productMap.get(item.productId.toString()),
          priceChange: productMap.get(item.productId.toString())?.price - item.priceWhenAdded || 0
        }));
      }

      return wishlist;
    } catch (error) {
      logger.error('Failed to get wishlist:', error);
      throw error;
    }
  }

  // Create new wishlist
  async createWishlist(userId, wishlistData) {
    try {
      const {
        name = 'My Wishlist',
        description = '',
        category = 'personal',
        isPublic = false,
        tags = []
      } = wishlistData;

      const wishlist = new Wishlist({
        userId,
        name,
        description,
        category,
        isPublic,
        tags
      });

      if (isPublic) {
        wishlist.generateShareToken();
      }

      await wishlist.save();
      return wishlist.toObject();
    } catch (error) {
      logger.error('Failed to create wishlist:', error);
      throw error;
    }
  }

  // Update wishlist
  async updateWishlist(wishlistId, userId, updateData) {
    try {
      const wishlist = await Wishlist.findOne({
        _id: wishlistId,
        userId,
        isActive: true
      });

      if (!wishlist) {
        throw new Error('Wishlist not found');
      }

      const allowedUpdates = ['name', 'description', 'category', 'isPublic', 'tags'];
      allowedUpdates.forEach(field => {
        if (updateData[field] !== undefined) {
          wishlist[field] = updateData[field];
        }
      });

      // Generate share token if making public
      if (updateData.isPublic && !wishlist.shareToken) {
        wishlist.generateShareToken();
      }

      await wishlist.save();
      return wishlist.toObject();
    } catch (error) {
      logger.error('Failed to update wishlist:', error);
      throw error;
    }
  }

  // Delete wishlist
  async deleteWishlist(wishlistId, userId) {
    try {
      const wishlist = await Wishlist.findOne({
        _id: wishlistId,
        userId,
        isActive: true
      });

      if (!wishlist) {
        throw new Error('Wishlist not found');
      }

      wishlist.isActive = false;
      await wishlist.save();

      return { success: true, message: 'Wishlist deleted successfully' };
    } catch (error) {
      logger.error('Failed to delete wishlist:', error);
      throw error;
    }
  }

  // Add item to wishlist
  async addToWishlist(userId, productId, options = {}) {
    try {
      const {
        wishlistId,
        priority = 1,
        notes = '',
        notifyOnPriceChange = false,
        notifyOnStock = false
      } = options;

      // Validate product
      const product = await Product.findById(productId);
      if (!product) {
        throw new Error('Product not found');
      }

      let wishlist;
      if (wishlistId) {
        wishlist = await Wishlist.findOne({
          _id: wishlistId,
          userId,
          isActive: true
        });
      } else {
        // Get or create default wishlist
        wishlist = await Wishlist.findOne({
          userId,
          name: 'My Wishlist',
          isActive: true
        });

        if (!wishlist) {
          wishlist = new Wishlist({
            userId,
            name: 'My Wishlist',
            category: 'personal'
          });
        }
      }

      if (!wishlist) {
        throw new Error('Wishlist not found');
      }

      const isNewItem = wishlist.addItem(productId, product.price, {
        priority,
        notes,
        notifyOnPriceChange,
        notifyOnStock
      });

      await wishlist.save();

      // Track interaction
      try {
        const { default: userInteractionService } = await import('./userInteractionService.js');
        await userInteractionService.trackInteraction({
          userId,
          sessionId: `wishlist_${wishlist._id}`,
          productId,
          interactionType: 'wishlist_add',
          metadata: {
            wishlistId: wishlist._id,
            priority,
            isNewItem
          }
        });
      } catch (error) {
        logger.warn('Failed to track wishlist interaction:', error);
      }

      return {
        wishlist: wishlist.toObject(),
        isNewItem,
        message: isNewItem ? 'Item added to wishlist' : 'Item updated in wishlist'
      };
    } catch (error) {
      logger.error('Failed to add to wishlist:', error);
      throw error;
    }
  }

  // Remove item from wishlist
  async removeFromWishlist(userId, wishlistId, productId) {
    try {
      const wishlist = await Wishlist.findOne({
        _id: wishlistId,
        userId,
        isActive: true
      });

      if (!wishlist) {
        throw new Error('Wishlist not found');
      }

      const removed = wishlist.removeItem(productId);
      if (!removed) {
        throw new Error('Item not found in wishlist');
      }

      await wishlist.save();

      // Track interaction
      try {
        const { default: userInteractionService } = await import('./userInteractionService.js');
        await userInteractionService.trackInteraction({
          userId,
          sessionId: `wishlist_${wishlist._id}`,
          productId,
          interactionType: 'wishlist_remove',
          metadata: {
            wishlistId: wishlist._id
          }
        });
      } catch (error) {
        logger.warn('Failed to track wishlist interaction:', error);
      }

      return {
        wishlist: wishlist.toObject(),
        message: 'Item removed from wishlist'
      };
    } catch (error) {
      logger.error('Failed to remove from wishlist:', error);
      throw error;
    }
  }

  // Move item between wishlists
  async moveItem(userId, fromWishlistId, toWishlistId, productId) {
    try {
      const [fromWishlist, toWishlist] = await Promise.all([
        Wishlist.findOne({ _id: fromWishlistId, userId, isActive: true }),
        Wishlist.findOne({ _id: toWishlistId, userId, isActive: true })
      ]);

      if (!fromWishlist || !toWishlist) {
        throw new Error('Wishlist not found');
      }

      // Find item in source wishlist
      const itemIndex = fromWishlist.items.findIndex(item =>
        item.productId.toString() === productId.toString()
      );

      if (itemIndex === -1) {
        throw new Error('Item not found in source wishlist');
      }

      const item = fromWishlist.items[itemIndex];

      // Add to target wishlist
      toWishlist.addItem(productId, item.priceWhenAdded, {
        priority: item.priority,
        notes: item.notes,
        notifyOnPriceChange: item.notifyOnPriceChange,
        notifyOnStock: item.notifyOnStock
      });

      // Remove from source wishlist
      fromWishlist.removeItem(productId);

      await Promise.all([
        fromWishlist.save(),
        toWishlist.save()
      ]);

      return {
        fromWishlist: fromWishlist.toObject(),
        toWishlist: toWishlist.toObject(),
        message: 'Item moved successfully'
      };
    } catch (error) {
      logger.error('Failed to move item between wishlists:', error);
      throw error;
    }
  }

  // Get wishlist by share token
  async getSharedWishlist(shareToken) {
    try {
      const wishlist = await Wishlist.findOne({
        shareToken,
        isPublic: true,
        isActive: true
      })
      .populate('userId', 'fullName')
      .lean();

      if (!wishlist) {
        throw new Error('Shared wishlist not found');
      }

      // Populate items with product details
      if (wishlist.items && wishlist.items.length > 0) {
        const productIds = wishlist.items.map(item => item.productId);
        const products = await Product.find({ _id: { $in: productIds } })
          .select('name price ProductImage Category stocks inStock rating reviewCount')
          .lean();

        const productMap = new Map(products.map(p => [p._id.toString(), p]));

        wishlist.items = wishlist.items.map(item => ({
          ...item,
          product: productMap.get(item.productId.toString()),
          priceChange: productMap.get(item.productId.toString())?.price - item.priceWhenAdded || 0
        }));
      }

      return wishlist;
    } catch (error) {
      logger.error('Failed to get shared wishlist:', error);
      throw error;
    }
  }

  // Get price change notifications
  async getPriceChangeNotifications() {
    try {
      const wishlists = await Wishlist.find({
        'items.notifyOnPriceChange': true,
        isActive: true
      })
      .populate('userId', 'email fullName')
      .lean();

      const notifications = [];

      for (const wishlist of wishlists) {
        const notifyItems = wishlist.items.filter(item => item.notifyOnPriceChange);
        
        if (notifyItems.length > 0) {
          const productIds = notifyItems.map(item => item.productId);
          const products = await Product.find({ _id: { $in: productIds } })
            .select('name price ProductImage')
            .lean();

          const productMap = new Map(products.map(p => [p._id.toString(), p]));

          for (const item of notifyItems) {
            const product = productMap.get(item.productId.toString());
            if (product && product.price < item.priceWhenAdded) {
              notifications.push({
                userId: wishlist.userId,
                wishlistId: wishlist._id,
                wishlistName: wishlist.name,
                productId: item.productId,
                productName: product.name,
                productImage: product.ProductImage,
                oldPrice: item.priceWhenAdded,
                newPrice: product.price,
                savings: item.priceWhenAdded - product.price
              });
            }
          }
        }
      }

      return notifications;
    } catch (error) {
      logger.error('Failed to get price change notifications:', error);
      return [];
    }
  }

  // Get stock notifications
  async getStockNotifications() {
    try {
      const wishlists = await Wishlist.find({
        'items.notifyOnStock': true,
        isActive: true
      })
      .populate('userId', 'email fullName')
      .lean();

      const notifications = [];

      for (const wishlist of wishlists) {
        const notifyItems = wishlist.items.filter(item => item.notifyOnStock);
        
        if (notifyItems.length > 0) {
          const productIds = notifyItems.map(item => item.productId);
          const products = await Product.find({ 
            _id: { $in: productIds },
            inStock: true,
            stocks: { $gt: 0 }
          })
          .select('name price ProductImage stocks')
          .lean();

          const productMap = new Map(products.map(p => [p._id.toString(), p]));

          for (const item of notifyItems) {
            const product = productMap.get(item.productId.toString());
            if (product) {
              notifications.push({
                userId: wishlist.userId,
                wishlistId: wishlist._id,
                wishlistName: wishlist.name,
                productId: item.productId,
                productName: product.name,
                productImage: product.ProductImage,
                currentPrice: product.price,
                stockQuantity: product.stocks
              });
            }
          }
        }
      }

      return notifications;
    } catch (error) {
      logger.error('Failed to get stock notifications:', error);
      return [];
    }
  }

  // Get wishlist analytics
  async getWishlistAnalytics(userId, options = {}) {
    try {
      const {
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate = new Date()
      } = options;

      const analytics = await Wishlist.aggregate([
        {
          $match: {
            userId: new mongoose.Types.ObjectId(userId),
            isActive: true,
            createdAt: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: null,
            totalWishlists: { $sum: 1 },
            totalItems: { $sum: '$totalItems' },
            totalValue: { $sum: '$totalValue' },
            avgItemsPerWishlist: { $avg: '$totalItems' },
            avgValuePerWishlist: { $avg: '$totalValue' }
          }
        }
      ]);

      return analytics[0] || {};
    } catch (error) {
      logger.error('Failed to get wishlist analytics:', error);
      return {};
    }
  }

  // Get popular wishlist items
  async getPopularWishlistItems(options = {}) {
    try {
      const {
        limit = 20,
        category,
        timeframe = 30 // days
      } = options;

      const startDate = new Date(Date.now() - timeframe * 24 * 60 * 60 * 1000);

      const pipeline = [
        {
          $match: {
            isActive: true,
            createdAt: { $gte: startDate }
          }
        },
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.productId',
            count: { $sum: 1 },
            avgPriority: { $avg: '$items.priority' },
            totalValue: { $sum: '$items.priceWhenAdded' }
          }
        },
        {
          $lookup: {
            from: 'products',
            localField: '_id',
            foreignField: '_id',
            as: 'product'
          }
        },
        { $unwind: '$product' }
      ];

      if (category) {
        pipeline.push({
          $match: { 'product.Category': category }
        });
      }

      pipeline.push(
        { $sort: { count: -1, avgPriority: -1 } },
        { $limit: limit }
      );

      const popularItems = await Wishlist.aggregate(pipeline);
      return popularItems;
    } catch (error) {
      logger.error('Failed to get popular wishlist items:', error);
      return [];
    }
  }
}

export default new WishlistService();