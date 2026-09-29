import "dotenv/config";
import app from "./app.js";
import connectDB from "./db/index.js";
const port = Number(process.env.PORT || 3000);

try {
  await connectDB();
  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
} catch (error) {
  console.error("Application startup failed:", error.message);
  process.exitCode = 1;
}


