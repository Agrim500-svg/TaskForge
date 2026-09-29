import "dotenv/config";
import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"

const app=express();

//basic configuration
app.use(express.json({limit: "16kb"}))
app.use(express.urlencoded({extended: true, limit: "16kb"}))
app.use(express.static("public"))
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

//import the routes
import healthcheckRouter from "./routes/healthcheck.routes.js";
import authRouter from "./routes/auth.routes.js";
import projectRouter from "./routes/project.routes.js";
import taskRouter from "./routes/task.routes.js";
import noteRouter from "./routes/note.routes.js";

app.use("/api/v1/healthCheck", healthcheckRouter);
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/project", projectRouter);
app.use("/api/v1/tasks", taskRouter);
app.use("/api/v1/notes", noteRouter);


app.get('/', (req, res) => {
  res.send('Welcome to basecampy!');
});

app.use((req, res, next) => {
  next(new ApiError(404, "Route not found"));
});

import { ApiError } from "./utils/api-error.js";
import { errorMiddleware } from "./middlewares/error.middleware.js";
app.use(errorMiddleware);

export default app;
