import dotenv from "dotenv";
import app from "./app";

const envFile =
  process.env.NODE_ENV === "production" ? ".env.production" : ".env.local";
// Load environment variables
dotenv.config({ path: envFile });
// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
