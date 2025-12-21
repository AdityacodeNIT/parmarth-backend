import mongoose from 'mongoose';
import logger from '../utils/logger.js';
import { Product } from '../models/product.models.js';
import redisClient from '../config/redis.js';

// Cart Item Schema
const CartItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
    default: 1
  },
  price: {
    type: Number,
    required: true
  },
  selectedVariant: {
    size: String,
    color: String,
    material: String
  },
  addedAt: {
    type: Date,
    default: Date.now
  }
});

// Cart Schema
const CartSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user',
    sparse: true,
    index: true
  },
  sessionId: {
    type: String,
    required: true,
    index: true
  },
  items: [CartItemSchema],
  totalAmount: {
    type: Number,
    default: 0
  },
  totalItems: {
    type: Number,
    default: 0
  },
  currency: {
    type: String,
    default: 'INR'
  },
  discountCode: {
    type: String
  },
  discountAmount: {
    type: Number,
    default: 0
  },
  shippingCost: {
    type: Number,
    default: 0
  },
  taxAmount: {
    type: Number,
    default: 0
  },
  finalAmount: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    index: { expireAfterSeconds: 0 }
  }
}, {
  timestamps: true
});

// Indexes
CartSchema.index({ userId: 1, isActive: 1 });
CartSchema.index({ sessionId: 1, isActive: 1 });
CartSchema.index({ updatedAt: -1 });

// Pre-save middleware to calculate totals
CartSchema.pre('save', function(next) {
  this.calculateTotals();
  next();
});

// Methods
CartSchema.methods.calculateTotals = function() {
  this.totalItems = this.items.reduce((sum, item) => sum + item.quantity, 0);
  this.totalAmount = this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  // Calculate final amount with discounts and shipping
  this.finalAmount = this.totalAmount - this.discountAmount + this.shippingCost + this.taxAmount;
};

CartSchema.methods.addItem = function(productId, quantity, price, variant = {}) {
  const existingItemIndex = this.items.findIndex(item => 
    item.productId.toString() === productId.toString() &&
    JSON.stringify(item.selectedVariant) === JSON.stringify(variant)
  );

  if (existingItemIndex > -1) {
    this.items[existingItemIndex].quantity += quantity;
  } else {
    this.items.push({
      productId,
      quantity,
      price,
      selectedVariant: variant
    });
  }

  this.calculateTotals();
};

CartSchema.methods.removeItem = function(productId, variant = {}) {
  this.items = this.items.filter(item => 
    !(item.productId.toString() === productId.toString() &&
      JSON.stringify(item.selectedVariant) === JSON.stringify(variant))
  );
  this.calculateTotals();
};

CartSchema.methods.updateItemQuantity = function(productId, quantity, variant = {}) {
  const item = this.items.find(item => 
    item.productId.toString() === productId.toString() &&
    JSON.stringify(item.selectedVariant) === JSON.stringify(variant)
  );

  if (item) {
    if (quantity <= 0) {
      this.removeItem(productId, variant);
    } else {
      item.quantity = quantity;
      this.calculateTotals();
    }
  }
};

const Cart = mongoose.model('Cart', CartSchema);

class CartService {
  constructor() {
    this.REDIS_PREFIX = 'cart:';
    this.REDIS_EXPIRY = 30 * 24 * 60 * 60; // 30 days in seconds
  }

  // Get or create cart
  async getCart(userId, sessionId) {
    try {
      let cart;

      // Try Redis first for better performance
      if (redisClient && redisClient.isReady) {
        const cacheKey = this.getCacheKey(userId, sessionId);
        const cachedCart = await redisClient.get(cacheKey);
        
        if (cachedCart) {
          cart = JSON.parse(cachedCart);
          // Populate product details
          cart = await this.populateCartItems(cart);
          return cart;
        }
      }

      // Find existing cart
      const query = { isActive: true };
      if (userId) {
        query.userId = userId;
      } else {
        query.sessionId = sessionId;
      }

      cart = await Cart.findOne(query)
        .populate('items.productId', 'name price ProductImage Category stocks inStock')
        .lean();

      if (!cart) {
        // Create new cart
        cart = new Cart({
          userId: userId || null,
          sessionId,
          items: []
        });
        await cart.save();
        cart = await Cart.findById(cart._id)
          .populate('items.productId', 'name price ProductImage Category stocks inStock')
          .lean();
      }

      // Cache in Redis
      if (redisClient && redisClient.isReady) {
        const cacheKey = this.getCacheKey(userId, sessionId);
        await redisClient.setex(cacheKey, this.REDIS_EXPIRY, JSON.stringify(cart));
      }

      return cart;
    } catch (error) {
      logger.error('Failed to get cart:', error);
      throw error;
    }
  }

  // Add item to cart
  async addToCart(userId, sessionId, productId, quantity = 1, variant = {}) {
    try {
      // Validate product
      const product = await Product.findById(productId);
      if (!product) {
        throw new Error('Product not found');
      }

      if (!product.inStock || product.stocks < quantity) {
        throw new Error('Insufficient stock');
      }

      // Get or create cart
      let cart = await Cart.findOne({
        $or: [
          { userId: userId, isActive: true },
          { sessionId: sessionId, isActive: true }
        ]
      });

      if (!cart) {
        cart = new Cart({
          userId: userId || null,
          sessionId,
          items: []
        });
      }

      // Add item
      cart.addItem(productId, quantity, product.price, variant);
      await cart.save();

      // Update cache
      await this.updateCache(userId, sessionId, cart);

      // Populate and return
      const populatedCart = await Cart.findById(cart._id)
        .populate('items.productId', 'name price ProductImage Category stocks inStock')
        .lean();

      // Track interaction
      try {
        const { default: userInteractionService } = await import('./userInteractionService.js');
        await userInteractionService.trackInteraction({
          userId: userId || null,
          sessionId,
          productId,
          interactionType: 'add_to_cart',
          metadata: {
            quantity,
            price: product.price,
            variant
          }
        });
      } catch (error) {
        logger.warn('Failed to track add to cart interaction:', error);
      }

      return populatedCart;
    } catch (error) {
      logger.error('Failed to add to cart:', error);
      throw error;
    }
  }

  // Remove item from cart
  async removeFromCart(userId, sessionId, productId, variant = {}) {
    try {
      const cart = await Cart.findOne({
        $or: [
          { userId: userId, isActive: true },
          { sessionId: sessionId, isActive: true }
        ]
      });

      if (!cart) {
        throw new Error('Cart not found');
      }

      cart.removeItem(productId, variant);
      await cart.save();

      // Update cache
      await this.updateCache(userId, sessionId, cart);

      // Track interaction
      try {
        const { default: userInteractionService } = await import('./userInteractionService.js');
        await userInteractionService.trackInteraction({
          userId: userId || null,
          sessionId,
          productId,
          interactionType: 'remove_from_cart',
          metadata: { variant }
        });
      } catch (error) {
        logger.warn('Failed to track remove from cart interaction:', error);
      }

      const populatedCart = await Cart.findById(cart._id)
        .populate('items.productId', 'name price ProductImage Category stocks inStock')
        .lean();

      return populatedCart;
    } catch (error) {
      logger.error('Failed to remove from cart:', error);
      throw error;
    }
  }

  // Update item quantity
  async updateCartItemQuantity(userId, sessionId, productId, quantity, variant = {}) {
    try {
      if (quantity < 0) {
        throw new Error('Quantity must be non-negative');
      }

      const cart = await Cart.findOne({
        $or: [
          { userId: userId, isActive: true },
          { sessionId: sessionId, isActive: true }
        ]
      });

      if (!cart) {
        throw new Error('Cart not found');
      }

      // Validate stock if increasing quantity
      if (quantity > 0) {
        const product = await Product.findById(productId);
        if (!product || !product.inStock || product.stocks < quantity) {
          throw new Error('Insufficient stock');
        }
      }

      cart.updateItemQuantity(productId, quantity, variant);
      await cart.save();

      // Update cache
      await this.updateCache(userId, sessionId, cart);

      const populatedCart = await Cart.findById(cart._id)
        .populate('items.productId', 'name price ProductImage Category stocks inStock')
        .lean();

      return populatedCart;
    } catch (error) {
      logger.error('Failed to update cart item quantity:', error);
      throw error;
    }
  }

  // Clear cart
  async clearCart(userId, sessionId) {
    try {
      const cart = await Cart.findOne({
        $or: [
          { userId: userId, isActive: true },
          { sessionId: sessionId, isActive: true }
        ]
      });

      if (cart) {
        cart.items = [];
        cart.calculateTotals();
        await cart.save();

        // Update cache
        await this.updateCache(userId, sessionId, cart);
      }

      return { success: true, message: 'Cart cleared successfully' };
    } catch (error) {
      logger.error('Failed to clear cart:', error);
      throw error;
    }
  }

  // Apply discount code
  async applyDiscount(userId, sessionId, discountCode) {
    try {
      const cart = await Cart.findOne({
        $or: [
          { userId: userId, isActive: true },
          { sessionId: sessionId, isActive: true }
        ]
      });

      if (!cart) {
        throw new Error('Cart not found');
      }

      // Validate discount code (implement your discount logic here)
      const discount = await this.validateDiscountCode(discountCode, cart);
      
      cart.discountCode = discountCode;
      cart.discountAmount = discount.amount;
      cart.calculateTotals();
      await cart.save();

      // Update cache
      await this.updateCache(userId, sessionId, cart);

      const populatedCart = await Cart.findById(cart._id)
        .populate('items.productId', 'name price ProductImage Category stocks inStock')
        .lean();

      return populatedCart;
    } catch (error) {
      logger.error('Failed to apply discount:', error);
      throw error;
    }
  }

  // Merge guest cart with user cart
  async mergeGuestCart(userId, guestSessionId) {
    try {
      const [userCart, guestCart] = await Promise.all([
        Cart.findOne({ userId, isActive: true }),
        Cart.findOne({ sessionId: guestSessionId, isActive: true })
      ]);

      if (!guestCart || guestCart.items.length === 0) {
        return userCart;
      }

      let targetCart = userCart;
      if (!targetCart) {
        // Convert guest cart to user cart
        guestCart.userId = userId;
        await guestCart.save();
        targetCart = guestCart;
      } else {
        // Merge items from guest cart to user cart
        for (const guestItem of guestCart.items) {
          const existingItem = targetCart.items.find(item =>
            item.productId.toString() === guestItem.productId.toString() &&
            JSON.stringify(item.selectedVariant) === JSON.stringify(guestItem.selectedVariant)
          );

          if (existingItem) {
            existingItem.quantity += guestItem.quantity;
          } else {
            targetCart.items.push(guestItem);
          }
        }

        targetCart.calculateTotals();
        await targetCart.save();

        // Deactivate guest cart
        guestCart.isActive = false;
        await guestCart.save();
      }

      // Update cache
      await this.updateCache(userId, null, targetCart);
      await this.clearCache(null, guestSessionId);

      const populatedCart = await Cart.findById(targetCart._id)
        .populate('items.productId', 'name price ProductImage Category stocks inStock')
        .lean();

      return populatedCart;
    } catch (error) {
      logger.error('Failed to merge guest cart:', error);
      throw error;
    }
  }

  // Get abandoned carts for recovery
  async getAbandonedCarts(options = {}) {
    try {
      const {
        minHours = 1,
        maxHours = 72,
        minValue = 0,
        limit = 100
      } = options;

      const minDate = new Date(Date.now() - maxHours * 60 * 60 * 1000);
      const maxDate = new Date(Date.now() - minHours * 60 * 60 * 1000);

      const abandonedCarts = await Cart.find({
        isActive: true,
        totalItems: { $gt: 0 },
        finalAmount: { $gte: minValue },
        updatedAt: { $gte: minDate, $lte: maxDate },
        userId: { $exists: true, $ne: null }
      })
      .populate('userId', 'email fullName')
      .populate('items.productId', 'name price ProductImage')
      .limit(limit)
      .sort({ updatedAt: -1 })
      .lean();

      return abandonedCarts;
    } catch (error) {
      logger.error('Failed to get abandoned carts:', error);
      throw error;
    }
  }

  // Calculate shipping cost
  async calculateShipping(cart, shippingAddress) {
    try {
      // Implement your shipping calculation logic here
      let shippingCost = 0;

      if (cart.totalAmount < 500) {
        shippingCost = 50; // Free shipping above ₹500
      }

      // Add location-based shipping costs
      if (shippingAddress && shippingAddress.state) {
        const remoteStates = ['Assam', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Tripura'];
        if (remoteStates.includes(shippingAddress.state)) {
          shippingCost += 25;
        }
      }

      return shippingCost;
    } catch (error) {
      logger.error('Failed to calculate shipping:', error);
      return 0;
    }
  }

  // Validate discount code
  async validateDiscountCode(code, cart) {
    try {
      // Implement your discount validation logic here
      const discounts = {
        'WELCOME10': { type: 'percentage', value: 10, minAmount: 100 },
        'SAVE50': { type: 'fixed', value: 50, minAmount: 200 },
        'NEWUSER': { type: 'percentage', value: 15, minAmount: 150 }
      };

      const discount = discounts[code.toUpperCase()];
      if (!discount) {
        throw new Error('Invalid discount code');
      }

      if (cart.totalAmount < discount.minAmount) {
        throw new Error(`Minimum order amount ₹${discount.minAmount} required`);
      }

      let amount = 0;
      if (discount.type === 'percentage') {
        amount = (cart.totalAmount * discount.value) / 100;
      } else {
        amount = discount.value;
      }

      return { amount, type: discount.type, value: discount.value };
    } catch (error) {
      throw error;
    }
  }

  // Cache management
  getCacheKey(userId, sessionId) {
    return `${this.REDIS_PREFIX}${userId || sessionId}`;
  }

  async updateCache(userId, sessionId, cart) {
    if (redisClient && redisClient.isReady) {
      try {
        const cacheKey = this.getCacheKey(userId, sessionId);
        await redisClient.setex(cacheKey, this.REDIS_EXPIRY, JSON.stringify(cart));
      } catch (error) {
        logger.warn('Failed to update cart cache:', error);
      }
    }
  }

  async clearCache(userId, sessionId) {
    if (redisClient && redisClient.isReady) {
      try {
        const cacheKey = this.getCacheKey(userId, sessionId);
        await redisClient.del(cacheKey);
      } catch (error) {
        logger.warn('Failed to clear cart cache:', error);
      }
    }
  }

  async populateCartItems(cart) {
    try {
      if (!cart.items || cart.items.length === 0) {
        return cart;
      }

      const productIds = cart.items.map(item => item.productId);
      const products = await Product.find({ _id: { $in: productIds } })
        .select('name price ProductImage Category stocks inStock')
        .lean();

      const productMap = new Map(products.map(p => [p._id.toString(), p]));

      cart.items = cart.items.map(item => ({
        ...item,
        productId: productMap.get(item.productId.toString()) || item.productId
      }));

      return cart;
    } catch (error) {
      logger.error('Failed to populate cart items:', error);
      return cart;
    }
  }

  // Get cart analytics
  async getCartAnalytics(options = {}) {
    try {
      const {
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate = new Date()
      } = options;

      const analytics = await Cart.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate, $lte: endDate },
            isActive: true
          }
        },
        {
          $group: {
            _id: null,
            totalCarts: { $sum: 1 },
            totalValue: { $sum: '$finalAmount' },
            avgCartValue: { $avg: '$finalAmount' },
            avgItemsPerCart: { $avg: '$totalItems' },
            abandonedCarts: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $gt: ['$totalItems', 0] },
                      { $lt: ['$updatedAt', new Date(Date.now() - 24 * 60 * 60 * 1000)] }
                    ]
                  },
                  1,
                  0
                ]
              }
            }
          }
        }
      ]);

      return analytics[0] || {};
    } catch (error) {
      logger.error('Failed to get cart analytics:', error);
      return {};
    }
  }
}

export default new CartService();