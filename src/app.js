import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import logger from "./utils/logger.js";
import routes from "./routes/index.js";
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
import infraHealthRoutes from "./routes/infra/health.routes.js";
import infradbRoutes from "./routes/infra/db.routes.js";


const app = express();

const onlyForReadRequests = (middleware) => {
  return (req, res, next) => {
    if (req.method === "GET" || req.method === "HEAD") {
      return middleware(req, res, next);
    }
    next();
  };
};

// Apply core middleware stack
app.use(correlationId);
app.use(requestTimeout(50000)); // 30 second timeout
app.use(requestLogger);
app.use(monitorRequestSize);



app.use(onlyForReadRequests(intelligentCompression));
app.use(onlyForReadRequests(responseOptimization));
app.use(onlyForReadRequests(etagMiddleware));
app.use(onlyForReadRequests(conditionalRequests));
app.use(onlyForReadRequests(streamingResponse));

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

app.options("*", cors());

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

app.get("/api/getKey", (req, res) =>
        res.status(200).json({ key: process.env.RAZORPAY_API_KEY }),
);

app.use("/api/v1", routes);
app.use("/",infraHealthRoutes);
app.use("/",infradbRoutes);

app.get('/active', (req, res) => {
        res.status(200).send('Server is active');
});

export { app };
