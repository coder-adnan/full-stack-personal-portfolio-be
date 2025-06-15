import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import { config } from "dotenv";
import routes from "./routes";
import { errorHandler, notFoundHandler } from "./middleware/error";

// Load environment variables
config();

const app = express();

// Middleware
app.use(helmet());
app.use(express.json());
app.use(cookieParser());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// CORS
app.use(
  cors({
    origin: true, // Allow all origins temporarily for debugging
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
    ],
    exposedHeaders: ["Content-Range", "X-Content-Range"],
    maxAge: 600,
  })
);

// Add detailed request logging middleware
app.use((req, _res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  console.log("Request Headers:", JSON.stringify(req.headers, null, 2));
  console.log("Request Body:", JSON.stringify(req.body, null, 2));
  console.log("Request Query:", JSON.stringify(req.query, null, 2));
  next();
});

// Add error logging middleware
app.use(
  (
    err: any,
    req: express.Request,
    _res: express.Response,
    next: express.NextFunction
  ) => {
    console.error("Error occurred:", {
      timestamp: new Date().toISOString(),
      path: req.path,
      method: req.method,
      error: err.message,
      stack: err.stack,
      headers: req.headers,
      body: req.body,
    });
    next(err);
  }
);

// Routes
app.use("/api", routes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
