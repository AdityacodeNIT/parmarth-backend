import { Router } from 'express';
import { body, param, query } from 'express-validator';
import cartController from '../controllers/cart.controller.js';
import { isAuthenticated } from '../middlewares/auth.middleware.js';
import { rateLimitMiddleware } from '../middlewares/rateLimiting.middleware.js';

const router = Router();

// Validation middleware
const addToCartValidation = [
  body('productId')
    .isMongoId()
    .withMessage('Product ID must be a valid MongoDB ObjectId'),
  
  body('quantity')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Quantity must be between 1 and 100'),
  
  body('variant')
    .optional()
    .isObject()
    .withMessage('Variant must be an object'),
  
  body('variant.size')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Size must be a string with maximum 50 characters'),
  
  body('variant.color')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Color must be a string with maximum 50 characters'),
  
  body('variant.material')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Material must be a string with maximum 50 characters')
];

const updateQuantityValidation = [
  param('productId')
    .isMongoId()
    .withMessage('Product ID must be a valid MongoDB ObjectId'),
  
  body('quantity')
    .isInt({ min: 0, max: 100 })
    .withMessage('Quantity must be between 0 and 100'),
  
  body('variant')
    .optional()
    .isObject()
    .withMessage('Variant must be an object')
];

const removeFromCartValidation = [
  param('productId')
    .isMongoId()
    .withMessage('Product ID must be a valid MongoDB ObjectId'),
  
  body('variant')
    .optional()
    .isObject()
    .withMessage('Variant must be an object')
];

const applyDiscountValidation = [
  body('discountCode')
    .isString()
    .trim()
    .isLength({ min: 3, max: 20 })
    .withMessage('Discount code must be between 3 and 20 characters')
];

const mergeCartValidation = [
  body('guestSessionId')
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Guest session ID is required')
];

const calculateShippingValidation = [
  body('shippingAddress')
    .optional()
    .isObject()
    .withMessage('Shipping address must be an object'),
  
  body('shippingAddress.state')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage('State must be a string with maximum 100 characters'),
  
  body('shippingAddress.city')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage('City must be a string with maximum 100 characters'),
  
  body('shippingAddress.pincode')
    .optional()
    .isString()
    .trim()
    .matches(/^[0-9]{6}$/)
    .withMessage('Pincode must be a 6-digit number')
];

// Public routes (with optional auth for guest cart support)
router.get(
  '/',
  rateLimitMiddleware('get-cart', { windowMs: 60000, max: 200 }), // 200 requests per minute,
  cartController.getCart
);

router.post(
  '/add',
  rateLimitMiddleware('add-to-cart', { windowMs: 60000, max: 100 }), // 100 requests per minute,
  addToCartValidation,
  cartController.addToCart
);

router.delete(
  '/remove/:productId',
  rateLimitMiddleware('remove-from-cart', { windowMs: 60000, max: 100 }), // 100 requests per minute,
  removeFromCartValidation,
  cartController.removeFromCart
);

router.put(
  '/update/:productId',
  rateLimitMiddleware('update-cart', { windowMs: 60000, max: 100 }), // 100 requests per minute,
  updateQuantityValidation,
  cartController.updateItemQuantity
);

router.delete(
  '/clear',
  rateLimitMiddleware('clear-cart', { windowMs: 60000, max: 20 }), // 20 requests per minute,
  cartController.clearCart
);

router.post(
  '/discount',
  rateLimitMiddleware('apply-discount', { windowMs: 60000, max: 30 }), // 30 requests per minute,
  applyDiscountValidation,
  cartController.applyDiscount
);

router.post(
  '/shipping/calculate',
  rateLimitMiddleware('calculate-shipping', { windowMs: 60000, max: 50 }), // 50 requests per minute,
  calculateShippingValidation,
  cartController.calculateShipping
);

router.get(
  '/validate',
  rateLimitMiddleware('validate-cart', { windowMs: 60000, max: 50 }), // 50 requests per minute,
  cartController.validateCart
);

// Authenticated user routes
router.post(
  '/merge',
  rateLimitMiddleware('merge-cart', { windowMs: 60000, max: 10 }), // 10 requests per minute
  isAuthenticated,
  mergeCartValidation,
  cartController.mergeGuestCart
);

// Admin routes
router.get(
  '/abandoned',
  rateLimitMiddleware('abandoned-carts', { windowMs: 60000, max: 20 }), // 20 requests per minute
  isAuthenticated,
  [
    query('minHours')
      .optional()
      .isInt({ min: 1, max: 168 })
      .withMessage('Min hours must be between 1 and 168'),
    
    query('maxHours')
      .optional()
      .isInt({ min: 1, max: 720 })
      .withMessage('Max hours must be between 1 and 720'),
    
    query('minValue')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Min value must be a positive number'),
    
    query('limit')
      .optional()
      .isInt({ min: 1, max: 500 })
      .withMessage('Limit must be between 1 and 500')
  ],
  cartController.getAbandonedCarts
);

router.get(
  '/analytics',
  rateLimitMiddleware('cart-analytics', { windowMs: 60000, max: 20 }), // 20 requests per minute
  isAuthenticated,
  [
    query('startDate')
      .optional()
      .isISO8601()
      .withMessage('Start date must be a valid ISO 8601 date'),
    
    query('endDate')
      .optional()
      .isISO8601()
      .withMessage('End date must be a valid ISO 8601 date')
  ],
  cartController.getCartAnalytics
);

export default router;