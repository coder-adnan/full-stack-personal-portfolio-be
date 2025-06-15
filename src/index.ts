import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import { config } from "dotenv";
import routes from "./routes";
import adminRoutes from "./routes/admin";
import { errorHandler, notFoundHandler } from "./middleware/error";
import commentRoutes from "./routes/comment";

// Load environment variables
config();

const app = express();

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  })
);

// Cookie parsing
app.use(cookieParser());

// Global rate limiting (more lenient)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Limit each IP to 200 requests per windowMs
  message: {
    status: "error",
    message: "Too many requests, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Blog-specific rate limiting (more lenient for blog routes)
const blogLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Limit each IP to 300 requests per windowMs for blog routes
  message: {
    status: "error",
    message: "Too many requests to blog endpoints, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply global rate limiting to all routes
app.use(globalLimiter);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api", routes);
app.use("/api/admin", adminRoutes);
app.use("/api/comments", commentRoutes);

// Apply blog-specific rate limiting to blog routes
app.use("/api/blog", blogLimiter);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
