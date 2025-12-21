import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import logger from "./utils/logger.js";
import { applySecurity } from "./middlewares/security.middleware.js";
import { 
        generalRateLimit, 
        burstProtection 
} from "./middlewares/rateLimiting.middleware.js";
import { 
        correlationId, 
        requestLogger, 
        monitorRequestSize,
        requestTimeout 
} from "./middlewares/apiProtection.middleware.js";
import { 
        intelligentCompression,
        responseOptimization,
        etagMiddleware,
        conditionalRequests,
        streamingResponse
} from "./middlewares/compression.middleware.js";

const app = express();

// Apply core middleware stack
app.use(correlationId);
app.use(requestTimeout(30000)); // 30 second timeout
app.use(requestLogger);
app.use(monitorRequestSize);

// Apply performance middleware
app.use(intelligentCompression);
app.use(responseOptimization);
app.use(etagMiddleware);
app.use(conditionalRequests);
app.use(streamingResponse);

// Apply security middleware stack
app.use(applySecurity);

// Apply rate limiting
app.use(burstProtection);
app.use(generalRateLimit);

// Enhanced CORS configuration
app.use(
        cors({
                origin: function (origin, callback) {
                        // Allow requests with no origin (mobile apps, etc.)
                        if (!origin) return callback(null, true);
                        
                        const allowedOrigins = process.env.CORS_ORIGIN|| ['http://localhost:5173'];
                        
                        if (allowedOrigins.includes(origin)) {
                                callback(null, true);
                        } else {
                                logger.warn('CORS blocked request', { origin, ip: origin });
                                callback(new Error('Not allowed by CORS'));
                        }
                },
                credentials: true,
                methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
                allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
                exposedHeaders: ['X-Request-ID'],
                maxAge: 86400 // 24 hours
        })
);

// Enhanced Helmet configuration
app.use(helmet({
        contentSecurityPolicy: {
                directives: {
                        defaultSrc: ["'self'"],
                        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
                        fontSrc: ["'self'", "https://fonts.gstatic.com"],
                        imgSrc: ["'self'", "data:", "https:", "blob:"],
                        scriptSrc: ["'self'", "https://checkout.razorpay.com"],
                        connectSrc: ["'self'", "https://api.razorpay.com"],
                        frameSrc: ["'self'", "https://api.razorpay.com"],
                        objectSrc: ["'none'"],
                        baseUri: ["'self'"]
                }
        },
        crossOriginEmbedderPolicy: false // Disable for Razorpay compatibility
}));

// Body parsing with size limits
app.use(express.json({ 
        limit: "2mb",
        verify: (req, res, buf) => {
                // Store raw body for webhook verification if needed
                req.rawBody = buf;
        }
}));

app.use(express.urlencoded({ 
        extended: true, 
        limit: "1mb",
        parameterLimit: 50 // Limit number of parameters
}));

app.use(express.static("public", {
        maxAge: '1d', // Cache static files for 1 day
        etag: true,
        lastModified: true
}));

app.use(cookieParser());

//routes
import userRouter from "./routes/user.routes.js";
import productRouter from "./routes/product.routes.js";
import addressRouter from "./routes/address.routes.js";
import paymentRouter from "./routes/payment.routes.js";
import Reviewrouter from "./routes/review.routes.js";
import WishListRouter from "./routes/wishlist.routes.js";

import cartRouter from "./routes/cart.routes.js";
import wishlistRouter from "./routes/wishlist.routes.js";


import shiprouter from "./routes/shiprocket.routes.js";
import interactionRouter from "./routes/interaction.routes.js";
import Subscriberouter from "./routes/subscriber.routes.js";
import sellerRouter from "./routes/seller.routes.js";



//routes Decleration

app.use("/api/v1/users", userRouter);

app.use("/api/v1/seller", sellerRouter);
app.use("/api/v1/product", productRouter);
app.use("/api/v1/address", addressRouter);
app.use("/api/v2/payments", paymentRouter);
app.use("/api/v2/review", Reviewrouter);
app.use("/api/v2/wishlist", WishListRouter);

app.use("/api/v1/cart", cartRouter);
app.use("/api/v1/wishlist", wishlistRouter);

app.use("/shiprocket", shiprouter);
app.use("/api/activity",interactionRouter);
app.use("/api/v1", Subscriberouter);




app.get("/api/getKey", (req, res) =>
        res.status(200).json({ key: process.env.RAZORPAY_API_KEY }),
);

// Health check endpoints
app.get('/health', async (req, res) => {
        try {
                const { checkDatabaseHealth } = await import('./db/index.js');
                const dbHealth = await checkDatabaseHealth();
                
                const overallStatus = dbHealth.status === 'healthy' ? 'OK' : 'DEGRADED';
                
                res.status(overallStatus === 'OK' ? 200 : 503).json({
                        status: overallStatus,
                        timestamp: new Date().toISOString(),
                        services: {
                                database: dbHealth.status,
                                uptime: process.uptime(),
                                memory: process.memoryUsage(),
                                version: process.env.npm_package_version || '1.0.0'
                        },
                        database: {
                                connected: dbHealth.connected,
                                readyState: dbHealth.readyState,
                                host: dbHealth.host,
                                collections: dbHealth.collections
                        }
                });
        } catch (error) {
                logger.error('Health check failed', { error: error.message });
                res.status(503).json({
                        status: 'ERROR',
                        timestamp: new Date().toISOString(),
                        error: 'Service unavailable'
                });
        }
});

// Database statistics endpoint (admin only)
app.get('/admin/db-stats', async (req, res) => {
        try {
                // This should be protected with admin authentication in production
                const { getDatabaseStats } = await import('./db/index.js');
                const stats = await getDatabaseStats();
                
                res.status(200).json({
                        success: true,
                        data: stats
                });
        } catch (error) {
                logger.error('Database stats request failed', { error: error.message });
                res.status(500).json({
                        success: false,
                        message: 'Failed to get database statistics'
                });
        }
});

app.get('/active', (req, res) => {
        res.status(200).send('Server is active');
});

// Application initialized without Redis dependency

export { app };
