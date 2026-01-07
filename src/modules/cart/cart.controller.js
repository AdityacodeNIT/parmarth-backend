import cartService from '../../services/cartService.js';
import logger from '../../utils/logger.js';
import { validationResult } from 'express-validator';

class CartController {
  // Get user's cart
  async getCart(req, res) {
    try {
      const userId = req.user?.id;
      const sessionId = req.sessionID || req.headers['x-session-id'] || 'anonymous';

      const cart = await cartService.getCart(userId, sessionId);

      res.json({
        success: true,
        data: { cart }
      });

    } catch (error) {
      logger.error('Failed to get cart:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get cart',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  // Add item to cart
  async addToCart(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const userId = req.user?.id;
      const sessionId = req.sessionID || req.headers['x-session-id'] || 'anonymous';
      const { productId, quantity = 1, variant = {} } = req.body;

      const cart = await cartService.addToCart(userId, sessionId, productId, quantity, variant);

      res.json({
        success: true,
        message: 'Item added to cart successfully',
        data: { cart }
      });

    } catch (error) {
      logger.error('Failed to add to cart:', error);
      
      if (error.message === 'Product not found') {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      if (error.message === 'Insufficient stock') {
        return res.status(400).json({
          success: false,
          message: 'Insufficient stock available'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to add item to cart',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  // Remove item from cart
  async removeFromCart(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const userId = req.user?.id;
      const sessionId = req.sessionID || req.headers['x-session-id'] || 'anonymous';
      const { productId } = req.params;
      const { variant = {} } = req.body;

      const cart = await cartService.removeFromCart(userId, sessionId, productId, variant);

      res.json({
        success: true,
        message: 'Item removed from cart successfully',
        data: { cart }
      });

    } catch (error) {
      logger.error('Failed to remove from cart:', error);
      
      if (error.message === 'Cart not found') {
        return res.status(404).json({
          success: false,
          message: 'Cart not found'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to remove item from cart',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  // Update item quantity
  async updateItemQuantity(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const userId = req.user?.id;
      const sessionId = req.sessionID || req.headers['x-session-id'] || 'anonymous';
      const { productId } = req.params;
      const { quantity, variant = {} } = req.body;

      const cart = await cartService.updateCartItemQuantity(userId, sessionId, productId, quantity, variant);

      res.json({
        success: true,
        message: 'Cart updated successfully',
        data: { cart }
      });

    } catch (error) {
      logger.error('Failed to update cart item quantity:', error);
      
      if (error.message === 'Cart not found') {
        return res.status(404).json({
          success: false,
          message: 'Cart not found'
        });
      }

      if (error.message === 'Insufficient stock') {
        return res.status(400).json({
          success: false,
          message: 'Insufficient stock available'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to update cart',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  // Clear cart
  async clearCart(req, res) {
    try {
      const userId = req.user?.id;
      const sessionId = req.sessionID || req.headers['x-session-id'] || 'anonymous';

      const result = await cartService.clearCart(userId, sessionId);

      res.json({
        success: true,
        message: 'Cart cleared successfully',
        data: result
      });

    } catch (error) {
      logger.error('Failed to clear cart:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to clear cart',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  // Apply discount code
  async applyDiscount(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const userId = req.user?.id;
      const sessionId = req.sessionID || req.headers['x-session-id'] || 'anonymous';
      const { discountCode } = req.body;

      const cart = await cartService.applyDiscount(userId, sessionId, discountCode);

      res.json({
        success: true,
        message: 'Discount applied successfully',
        data: { cart }
      });

    } catch (error) {
      logger.error('Failed to apply discount:', error);
      
      if (error.message.includes('Invalid discount code') || error.message.includes('Minimum order amount')) {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to apply discount',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  // Merge guest cart with user cart (called after login)
  async mergeGuestCart(req, res) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const { guestSessionId } = req.body;
      if (!guestSessionId) {
        return res.status(400).json({
          success: false,
          message: 'Guest session ID is required'
        });
      }

      const cart = await cartService.mergeGuestCart(userId, guestSessionId);

      res.json({
        success: true,
        message: 'Cart merged successfully',
        data: { cart }
      });

    } catch (error) {
      logger.error('Failed to merge guest cart:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to merge cart',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  // Calculate shipping cost
  async calculateShipping(req, res) {
    try {
      const userId = req.user?.id;
      const sessionId = req.sessionID || req.headers['x-session-id'] || 'anonymous';
      const { shippingAddress } = req.body;

      const cart = await cartService.getCart(userId, sessionId);
      const shippingCost = await cartService.calculateShipping(cart, shippingAddress);

      res.json({
        success: true,
        data: {
          shippingCost,
          freeShippingThreshold: 500,
          isFreeShipping: cart.totalAmount >= 500
        }
      });

    } catch (error) {
      logger.error('Failed to calculate shipping:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to calculate shipping',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  // Get abandoned carts (admin only)
  async getAbandonedCarts(req, res) {
    try {
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      const {
        minHours = 1,
        maxHours = 72,
        minValue = 0,
        limit = 100
      } = req.query;

      const abandonedCarts = await cartService.getAbandonedCarts({
        minHours: parseInt(minHours),
        maxHours: parseInt(maxHours),
        minValue: parseFloat(minValue),
        limit: parseInt(limit)
      });

      res.json({
        success: true,
        data: {
          carts: abandonedCarts,
          total: abandonedCarts.length
        }
      });

    } catch (error) {
      logger.error('Failed to get abandoned carts:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get abandoned carts',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  // Get cart analytics (admin only)
  async getCartAnalytics(req, res) {
    try {
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      const {
        startDate,
        endDate
      } = req.query;

      const options = {};
      if (startDate) options.startDate = new Date(startDate);
      if (endDate) options.endDate = new Date(endDate);

      const analytics = await cartService.getCartAnalytics(options);

      res.json({
        success: true,
        data: { analytics }
      });

    } catch (error) {
      logger.error('Failed to get cart analytics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get cart analytics',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  // Validate cart before checkout
  async validateCart(req, res) {
    try {
      const userId = req.user?.id;
      const sessionId = req.sessionID || req.headers['x-session-id'] || 'anonymous';

      const cart = await cartService.getCart(userId, sessionId);
      
      if (!cart || !cart.items || cart.items.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Cart is empty'
        });
      }

      const validationErrors = [];
      
      // Check stock availability for each item
      for (const item of cart.items) {
        const product = item.productId;
        
        if (!product) {
          validationErrors.push({
            productId: item.productId,
            error: 'Product not found'
          });
          continue;
        }

        if (!product.inStock || product.stocks < item.quantity) {
          validationErrors.push({
            productId: item.productId,
            productName: product.name,
            requestedQuantity: item.quantity,
            availableStock: product.stocks,
            error: 'Insufficient stock'
          });
        }

        // Check if price has changed
        if (Math.abs(product.price - item.price) > 0.01) {
          validationErrors.push({
            productId: item.productId,
            productName: product.name,
            oldPrice: item.price,
            newPrice: product.price,
            error: 'Price has changed'
          });
        }
      }

      const isValid = validationErrors.length === 0;

      res.json({
        success: true,
        data: {
          isValid,
          cart,
          validationErrors,
          message: isValid ? 'Cart is valid for checkout' : 'Cart validation failed'
        }
      });

    } catch (error) {
      logger.error('Failed to validate cart:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to validate cart',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
}

export default new CartController();