import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import { ApiError } from "../utils/ApiError.js";
import logger from "../utils/logger.js";

// Get __dirname equivalent in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define the directory path
const tempDirectory = path.join(__dirname, "public/temp");
if (!fs.existsSync(tempDirectory)) {
        fs.mkdirSync(tempDirectory, { recursive: true });
}

// Security configuration
const ALLOWED_MIME_TYPES = {
        images: [
                'image/jpeg',
                'image/jpg', 
                'image/png',
                'image/gif',
                'image/webp'
        ],
        documents: [
                'application/pdf',
                'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ]
};

const MAX_FILE_SIZE = {
        image: 5 * 1024 * 1024, // 5MB
        document: 10 * 1024 * 1024 // 10MB
};

// Enhanced storage configuration with security
const storage = multer.diskStorage({
        destination: function (req, file, cb) {
                cb(null, tempDirectory);
        },

        filename: function (req, file, cb) {
                try {
                        // Generate cryptographically secure filename
                        const randomBytes = crypto.randomBytes(16).toString('hex');
                        const timestamp = Date.now();
                        const fileExtension = path.extname(file.originalname).toLowerCase();
                        
                        // Validate file extension
                        const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf', '.doc', '.docx'];
                        if (!allowedExtensions.includes(fileExtension)) {
                                return cb(new ApiError(400, 'Invalid file extension'));
                        }
                        
                        const secureFilename = `${timestamp}-${randomBytes}${fileExtension}`;
                        cb(null, secureFilename);
                } catch (error) {
                        logger.error('File naming error', { error: error.message });
                        cb(new ApiError(500, 'File processing error'));
                }
        }
});

// File filter with enhanced security
const fileFilter = (req, file, cb) => {
        try {
                // Check MIME type
                const allAllowedTypes = [...ALLOWED_MIME_TYPES.images, ...ALLOWED_MIME_TYPES.documents];
                if (!allAllowedTypes.includes(file.mimetype)) {
                        logger.warn('Rejected file with invalid MIME type', {
                                mimetype: file.mimetype,
                                originalname: file.originalname,
                                ip: req.ip,
                                userId: req.user?.id
                        });
                        return cb(new ApiError(400, `File type ${file.mimetype} not allowed`));
                }

                // Check file extension matches MIME type
                const fileExtension = path.extname(file.originalname).toLowerCase();
                const isImageMime = ALLOWED_MIME_TYPES.images.includes(file.mimetype);
                const isImageExt = ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(fileExtension);
                
                if (isImageMime !== isImageExt) {
                        logger.warn('MIME type and extension mismatch', {
                                mimetype: file.mimetype,
                                extension: fileExtension,
                                originalname: file.originalname,
                                ip: req.ip
                        });
                        return cb(new ApiError(400, 'File type mismatch detected'));
                }

                // Check for suspicious filenames
                const suspiciousPatterns = [
                        /\.php$/i, /\.asp$/i, /\.jsp$/i, /\.exe$/i, /\.bat$/i, /\.cmd$/i,
                        /\.sh$/i, /\.py$/i, /\.rb$/i, /\.pl$/i, /\.js$/i, /\.html$/i
                ];
                
                if (suspiciousPatterns.some(pattern => pattern.test(file.originalname))) {
                        logger.warn('Suspicious filename detected', {
                                originalname: file.originalname,
                                ip: req.ip,
                                userId: req.user?.id
                        });
                        return cb(new ApiError(400, 'Suspicious file detected'));
                }

                cb(null, true);
        } catch (error) {
                logger.error('File filter error', { error: error.message });
                cb(new ApiError(500, 'File validation error'));
        }
};

// Base multer configuration
const createUpload = (options = {}) => {
        const {
                maxFileSize = MAX_FILE_SIZE.image,
                maxFiles = 5,
                allowedTypes = 'images'
        } = options;

        return multer({
                storage,
                fileFilter,
                limits: {
                        fileSize: maxFileSize,
                        files: maxFiles,
                        fields: 20, // Limit number of form fields
                        fieldNameSize: 100, // Limit field name size
                        fieldSize: 1024 * 1024 // 1MB per field
                }
        });
};

// Specific upload configurations
export const upload = createUpload();

export const uploadImage = createUpload({
        maxFileSize: MAX_FILE_SIZE.image,
        maxFiles: 1,
        allowedTypes: 'images'
});

export const uploadMultipleImages = createUpload({
        maxFileSize: MAX_FILE_SIZE.image,
        maxFiles: 10,
        allowedTypes: 'images'
});

export const uploadDocument = createUpload({
        maxFileSize: MAX_FILE_SIZE.document,
        maxFiles: 1,
        allowedTypes: 'documents'
});

// Enhanced upload middleware with additional security
export const secureUpload = (fieldName, options = {}) => {
        const uploader = createUpload(options);
        
        return (req, res, next) => {
                uploader.single(fieldName)(req, res, (err) => {
                        if (err) {
                                if (err instanceof multer.MulterError) {
                                        let message = 'File upload error';
                                        
                                        switch (err.code) {
                                                case 'LIMIT_FILE_SIZE':
                                                        message = `File too large. Maximum size: ${options.maxFileSize || MAX_FILE_SIZE.image} bytes`;
                                                        break;
                                                case 'LIMIT_FILE_COUNT':
                                                        message = `Too many files. Maximum: ${options.maxFiles || 1}`;
                                                        break;
                                                case 'LIMIT_UNEXPECTED_FILE':
                                                        message = 'Unexpected file field';
                                                        break;
                                                default:
                                                        message = err.message;
                                        }
                                        
                                        logger.warn('Multer upload error', {
                                                error: err.code,
                                                message: err.message,
                                                field: err.field,
                                                ip: req.ip,
                                                userId: req.user?.id
                                        });
                                        
                                        return res.status(400).json({
                                                success: false,
                                                message
                                        });
                                }
                                
                                if (err instanceof ApiError) {
                                        return res.status(err.statusCode).json({
                                                success: false,
                                                message: err.message
                                        });
                                }
                                
                                logger.error('Upload middleware error', {
                                        error: err.message,
                                        stack: err.stack
                                });
                                
                                return res.status(500).json({
                                        success: false,
                                        message: 'File upload failed'
                                });
                        }
                        
                        // Additional security check after upload
                        if (req.file) {
                                // Log successful upload
                                logger.info('File uploaded successfully', {
                                        filename: req.file.filename,
                                        originalname: req.file.originalname,
                                        mimetype: req.file.mimetype,
                                        size: req.file.size,
                                        userId: req.user?.id
                                });
                                
                                // Perform additional security checks here if needed
                                // e.g., virus scanning, content analysis
                        }
                        
                        next();
                });
        };
};

// Cleanup function for temporary files
export const cleanupTempFiles = (req, res, next) => {
        const originalSend = res.send;
        
        res.send = function(data) {
                // Clean up uploaded files after response
                if (req.file) {
                        fs.unlink(req.file.path, (err) => {
                                if (err) {
                                        logger.error('Failed to cleanup temp file', {
                                                file: req.file.path,
                                                error: err.message
                                        });
                                }
                        });
                }
                
                if (req.files) {
                        Object.values(req.files).flat().forEach(file => {
                                fs.unlink(file.path, (err) => {
                                        if (err) {
                                                logger.error('Failed to cleanup temp file', {
                                                        file: file.path,
                                                        error: err.message
                                                });
                                        }
                                });
                        });
                }
                
                originalSend.call(this, data);
        };
        
        next();
};
