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
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(cookieParser());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// CORS Configurations
app.use(
  cors({
    origin: [
      process.env.FRONTEND_URL ||
        "https://full-stack-personal-portfolio-tau.vercel.app",
      "https://full-stack-personal-portfolio-tau.vercel.app/en",
      "https://full-stack-personal-portfolio-tau.vercel.app/",
      "http://localhost:5173",
      "http://localhost:3000",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    exposedHeaders: ["Content-Range", "X-Content-Range"],
    maxAge: 600, // Cache preflight request for 10 minutes
  })
);

// Add a debug middleware to log requests
app.use(
  (
    req: express.Request,
    _res: express.Response,
    next: express.NextFunction
  ) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    console.log("Headers:", req.headers);
    next();
  }
);

// Routes
app.use("/api", routes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
