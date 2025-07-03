import { body, param, query, validationResult } from "express-validator";

// Common reusable validations
export const commonValidations = {
    pagination: [
        query('page')
            .optional()
            .isInt({ min: 1 })
            .withMessage('Page must be a positive number'),
        query('limit')
            .optional()
            .isInt({ min: 1, max: 100 })
            .withMessage('Limit must be between 1 and 100'),
    ],
    email: body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email'),
    fullName: body('fullName')
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage('Please provide a valid full name (2-50 characters)'),
    password: body('password')
        .isLength({ min: 6 })
        .withMessage('Password must be at least 6 characters long'),
    username: body('username')
        .trim()
        .isLength({ min: 3, max: 30 })
        .withMessage('Username must be between 3 and 30 characters'),
};

// Main validator middleware
export const validate = (validations) => {
    return async (req, res, next) => {
        await Promise.all(validations.map(validation => validation.run(req)));

        const errors = validationResult(req);
        if (errors.isEmpty()) {
            return next();
        }

        const extractedErrors = errors.array().map(err => ({
            field: err.path,
            message: err.msg
        }));

        return res.status(422).json({
            success: false,
            errors: extractedErrors,
        });
    };
};

// Register validator middleware
export const validateRegister = validate([
    commonValidations.email,
    commonValidations.fullName,
    commonValidations.password,
    commonValidations.username,
]);
