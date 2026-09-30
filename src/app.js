import "dotenv/config";
import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"
import { fileURLToPath } from "node:url";
import { ApiError } from "./utils/api-error.js";
import { errorMiddleware } from "./middlewares/error.middleware.js";

const app=express();
// Render terminates TLS at one trusted proxy. This lets IP-based auth limits
// use the client address instead of treating every visitor as the proxy.
app.set("trust proxy", 1);

//basic configuration
app.use(express.json({limit: "16kb"}))
app.use(express.urlencoded({extended: true, limit: "16kb"}))
app.use(express.static(fileURLToPath(new URL("../public", import.meta.url)), {
  setHeaders(response) {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  },
}))
app.use(cookieParser())


//cors configuration
const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

if (allowedOrigins.includes("*")) {
  throw new Error("CORS_ORIGIN must list explicit origins when credentials are enabled");
}

app.use(cors({
  origin(origin, callback) {
    // Allow server-to-server and same-origin requests without an Origin header.
    callback(null, !origin || allowedOrigins.includes(origin));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

// CORS controls which scripts can read responses; it does not stop simple
// cross-origin form submissions. Check browser origins on cookie-authenticated
// state changes to prevent CSRF while still allowing non-browser bearer clients.
const stateChangingMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
app.use((req, res, next) => {
  if (!stateChangingMethods.has(req.method) || (!req.cookies?.accessToken && !req.cookies?.refreshToken)) {
    return next();
  }
  const origin = req.get("Origin");
  if (!origin || !allowedOrigins.includes(origin)) {
    return next(new ApiError(403, "Request origin is not allowed"));
  }
  return next();
});

//import the routes
import healthcheckRouter from "./routes/healthcheck.routes.js";
import authRouter from "./routes/auth.routes.js";
import projectRouter from "./routes/project.routes.js";
import taskRouter from "./routes/task.routes.js";
import noteRouter from "./routes/note.routes.js";
import notificationRouter from "./routes/notification.routes.js";

app.use("/api/v1/healthCheck", healthcheckRouter);
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/project", projectRouter);
app.use("/api/v1/tasks", taskRouter);
app.use("/api/v1/notes", noteRouter);
app.use("/api/v1/notifications", notificationRouter);


app.get('/', (req, res) => {
  res.send('Welcome to the TaskForge API!');
});

app.use((req, res, next) => {
  next(new ApiError(404, "Route not found"));
});

app.use(errorMiddleware);

export default app;
