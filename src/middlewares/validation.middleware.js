import { body, param, query, validationResult } from "express-validator";
import { ApiError } from "../utils/ApiError.js";
import logger from "../utils/logger.js";
import validator from "validator";

// Security sanitization functions
const sanitizeInput = (value) => {
    if (typeof value !== 'string') return value;

    // XSS protection using validator.js
    let sanitized = validator.escape(value);

    return sanitized.trim();
};

const sanitizeHtml = (value) => {
    if (typeof value !== 'string') return value;

    // Basic HTML sanitization - remove script tags and dangerous attributes
    let sanitized = value.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    sanitized = sanitized.replace(/on\w+="[^"]*"/gi, ''); // Remove event handlers
    sanitized = sanitized.replace(/javascript:/gi, ''); // Remove javascript: URLs
    
    return sanitized;
};

// Enhanced common validations with security
export const commonValidations = {
    pagination: [
        query('page')
            .optional()
            .isInt({ min: 1, max: 1000 })
            .withMessage('Page must be between 1 and 1000')
            .toInt(),
        query('limit')
            .optional()
            .isInt({ min: 1, max: 100 })
            .withMessage('Limit must be between 1 and 100')
            .toInt(),
        query('sort')
            .optional()
            .isIn(['asc', 'desc', '1', '-1'])
            .withMessage('Sort must be asc, desc, 1, or -1'),
        query('sortBy')
            .optional()
            .isAlpha()
            .isLength({ max: 50 })
            .withMessage('Sort field must be alphabetic and max 50 characters')
    ],

    email: body('email')
        .trim()
        .isEmail()
        .normalizeEmail({
            gmail_remove_dots: false,
            gmail_remove_subaddress: false
        })
        .isLength({ max: 254 })
        .withMessage('Please provide a valid email address')
        .customSanitizer(sanitizeInput),

    fullName: body('fullName')
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('Full name must be between 2 and 100 characters')
        .matches(/^[a-zA-Z\s'-\.]+$/)
        .withMessage('Full name can only contain letters, spaces, hyphens, apostrophes, and periods')
        .customSanitizer(sanitizeInput),

    password: body('password')
        .isLength({ min: 8, max: 128 })
        .withMessage('Password must be between 8 and 128 characters')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
        .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),

    username: body('username')
        .trim()
        .isLength({ min: 3, max: 30 })
        .withMessage('Username must be between 3 and 30 characters')
        .matches(/^[a-zA-Z0-9_-]+$/)
        .withMessage('Username can only contain letters, numbers, underscores, and hyphens')
        .customSanitizer(sanitizeInput),

    phoneNumber: body('phoneNumber')
        .optional()
        .isMobilePhone('any', { strictMode: false })
        .withMessage('Please provide a valid phone number')
        .customSanitizer(sanitizeInput),

    objectId: (field) => param(field)
        .isMongoId()
        .withMessage(`${field} must be a valid MongoDB ObjectId`),

    url: (field) => body(field)
        .optional()
        .isURL({
            protocols: ['http', 'https'],
            require_protocol: true
        })
        .withMessage(`${field} must be a valid URL`)
        .customSanitizer(sanitizeInput),

    price: body('price')
        .isFloat({ min: 0, max: 999999.99 })
        .withMessage('Price must be a positive number up to 999,999.99')
        .toFloat(),

    quantity: body('quantity')
        .isInt({ min: 0, max: 10000 })
        .withMessage('Quantity must be between 0 and 10,000')
        .toInt(),

    description: body('description')
        .optional()
        .isLength({ max: 5000 })
        .withMessage('Description must not exceed 5000 characters')
        .customSanitizer(sanitizeHtml),

    searchQuery: query('q')
        .optional()
        .isLength({ min: 1, max: 100 })
        .withMessage('Search query must be between 1 and 100 characters')
        .customSanitizer(sanitizeInput),

    category: body('category')
        .optional()
        .isIn(['Writing', 'Paper', 'DeskSupplies', 'Filing', 'Reusable', 'TechStationery'])
        .withMessage('Invalid category selected'),

    role: body('role')
        .optional()
        .isIn(['customer', 'seller', 'admin', 'superadmin'])
        .withMessage('Invalid role specified'),

    dateRange: [
        query('startDate')
            .optional()
            .isISO8601()
            .withMessage('Start date must be a valid ISO 8601 date')
            .toDate(),
        query('endDate')
            .optional()
            .isISO8601()
            .withMessage('End date must be a valid ISO 8601 date')
            .toDate()
    ]
};

// Enhanced validator middleware with security logging
export const validate = (validations, options = {}) => {
    const {
        logFailures = true,
        sanitizeOutput = true,
        skipSuccessLog = true
    } = options;

    return async (req, res, next) => {
        try {
            // Run all validations
            await Promise.all(validations.map(validation => validation.run(req)));

            const errors = validationResult(req);

            if (errors.isEmpty()) {
                if (!skipSuccessLog) {
                    logger.debug('Validation passed', {
                        endpoint: req.originalUrl,
                        method: req.method,
                        userId: req.user?.id
                    });
                }
                return next();
            }

            // Extract and format errors
            const extractedErrors = errors.array().map(err => ({
                field: err.path || err.param,
                message: err.msg,
                value: sanitizeOutput ? '[REDACTED]' : err.value,
                location: err.location
            }));

            // Log validation failures for security monitoring
            if (logFailures) {
                logger.warn('Input validation failed', {
                    endpoint: req.originalUrl,
                    method: req.method,
                    errors: extractedErrors,
                    ip: req.ip,
                    userAgent: req.get('User-Agent'),
                    userId: req.user?.id,
                    body: sanitizeOutput ? '[REDACTED]' : req.body
                });
            }

            // Return validation errors
            return res.status(422).json({
                success: false,
                message: 'Validation failed',
                errors: extractedErrors
            });

        } catch (error) {
            logger.error('Validation middleware error', {
                error: error.message,
                stack: error.stack,
                endpoint: req.originalUrl
            });

            return res.status(500).json({
                success: false,
                message: 'Internal validation error'
            });
        }
    };
};

// Register validator middleware
export const validateRegister = validate([
    commonValidations.email,
    commonValidations.fullName,
    commonValidations.password,
    commonValidations.username,
]);
// Specific validation rules for different endpoints
export const validationRules = {
    // User validations
    register: validate([
        commonValidations.email,
        commonValidations.fullName,
        commonValidations.password,
        commonValidations.username,
        commonValidations.phoneNumber
    ]),

    login: validate([
        body('email').optional().isEmail().normalizeEmail(),
        body('username').optional().isLength({ min: 3, max: 30 }),
        body('password').notEmpty().withMessage('Password is required'),
        body().custom((value, { req }) => {
            if (!req.body.email && !req.body.username) {
                throw new Error('Either email or username is required');
            }
            return true;
        })
    ]),

    changePassword: validate([
        body('currentPassword')
            .notEmpty()
            .withMessage('Current password is required'),
        commonValidations.password.withMessage('New password must meet security requirements'),
        body('confirmPassword')
            .notEmpty()
            .withMessage('Password confirmation is required')
            .custom((value, { req }) => {
                if (value !== req.body.password) {
                    throw new Error('Password confirmation does not match');
                }
                return true;
            })
    ]),

    updateProfile: validate([
        commonValidations.fullName.optional(),
        commonValidations.email.optional(),
        commonValidations.phoneNumber
    ]),

    resetPassword: validate([
        body('token')
            .notEmpty()
            .isLength({ min: 10, max: 200 })
            .withMessage('Valid reset token is required'),
        commonValidations.password,
        body('confirmPassword')
            .notEmpty()
            .custom((value, { req }) => {
                if (value !== req.body.newPassword) {
                    throw new Error('Password confirmation does not match');
                }
                return true;
            })
    ]),

    // Product validations
    createProduct: validate([
        body('name')
            .trim()
            .isLength({ min: 2, max: 200 })
            .withMessage('Product name must be between 2 and 200 characters')
            .customSanitizer(sanitizeInput),
        commonValidations.price,
        commonValidations.description,
        commonValidations.category,
        commonValidations.quantity,
        body('sku')
            .trim()
            .isLength({ min: 3, max: 50 })
            .matches(/^[A-Z0-9-_]+$/)
            .withMessage('SKU must contain only uppercase letters, numbers, hyphens, and underscores')
    ]),

    updateProduct: validate([
        commonValidations.objectId('id'),
        body('name').optional().trim().isLength({ min: 2, max: 200 }),
        commonValidations.price.optional(),
        commonValidations.description,
        commonValidations.category.optional(),
        commonValidations.quantity.optional()
    ]),

    // Order validations
    createOrder: validate([
        body('items')
            .isArray({ min: 1, max: 50 })
            .withMessage('Order must contain 1-50 items'),
        body('items.*.productId')
            .isMongoId()
            .withMessage('Each item must have a valid product ID'),
        body('items.*.quantity')
            .isInt({ min: 1, max: 100 })
            .withMessage('Item quantity must be between 1 and 100'),
        body('shippingAddress.firstName')
            .trim()
            .isLength({ min: 1, max: 50 })
            .matches(/^[a-zA-Z\s'-]+$/)
            .withMessage('First name is required and must contain only letters'),
        body('shippingAddress.lastName')
            .trim()
            .isLength({ min: 1, max: 50 })
            .matches(/^[a-zA-Z\s'-]+$/)
            .withMessage('Last name is required and must contain only letters'),
        body('shippingAddress.address1')
            .trim()
            .isLength({ min: 5, max: 200 })
            .withMessage('Address line 1 must be between 5 and 200 characters'),
        body('shippingAddress.city')
            .trim()
            .isLength({ min: 2, max: 100 })
            .matches(/^[a-zA-Z\s'-]+$/)
            .withMessage('City must contain only letters'),
        body('shippingAddress.postalCode')
            .trim()
            .matches(/^[0-9]{5,10}$/)
            .withMessage('Postal code must be 5-10 digits'),
        body('shippingAddress.country')
            .trim()
            .isLength({ min: 2, max: 100 })
            .matches(/^[a-zA-Z\s]+$/)
            .withMessage('Country must contain only letters')
    ]),

    // Review validations
    createReview: validate([
        commonValidations.objectId('productId'),
        body('rating')
            .isInt({ min: 1, max: 5 })
            .withMessage('Rating must be between 1 and 5'),
        body('title')
            .optional()
            .trim()
            .isLength({ max: 100 })
            .withMessage('Review title must not exceed 100 characters')
            .customSanitizer(sanitizeInput),
        body('comment')
            .optional()
            .trim()
            .isLength({ max: 1000 })
            .withMessage('Review comment must not exceed 1000 characters')
            .customSanitizer(sanitizeHtml)
    ]),

    // Search and filter validations
    searchProducts: validate([
        commonValidations.searchQuery,
        ...commonValidations.pagination,
        query('category')
            .optional()
            .isIn(['Writing', 'Paper', 'DeskSupplies', 'Filing', 'Reusable', 'TechStationery'])
            .withMessage('Invalid category filter'),
        query('minPrice')
            .optional()
            .isFloat({ min: 0 })
            .withMessage('Minimum price must be a positive number')
            .toFloat(),
        query('maxPrice')
            .optional()
            .isFloat({ min: 0 })
            .withMessage('Maximum price must be a positive number')
            .toFloat(),
        query('inStock')
            .optional()
            .isBoolean()
            .withMessage('In stock filter must be true or false')
            .toBoolean()
    ]),

    // Admin validations
    updateUserRole: validate([
        commonValidations.objectId('userId'),
        commonValidations.role
    ]),

    // File upload validations
    uploadFile: validate([
        body().custom((value, { req }) => {
            if (!req.file && !req.files) {
                throw new Error('File is required');
            }
            return true;
        })
    ])
};

// Update the existing register validation to use the new rules
