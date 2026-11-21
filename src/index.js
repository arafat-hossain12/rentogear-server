import "dotenv/config";
import express from "express";
import cors from "cors";
import { connectDB } from "./db.js";
import { allowedOrigins } from "./utils.js";
import { startBookingJobs } from "./jobs/bookingJobs.js";
import profileRoutes from "./routes/profile.js";
import equipmentRoutes from "./routes/equipment.js";
import ownerEquipmentRoutes from "./routes/ownerEquipment.js";
import favoritesRoutes from "./routes/favorites.js";
import bookingRoutes from "./routes/bookings.js";
import adminRoutes from "./routes/admin.js";
import analyticsRoutes from "./routes/analytics.js";
import reviewRoutes from "./routes/reviews.js";

const app = express();

app.use(cors({ origin: allowedOrigins(), credentials: true }));
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "RentoGear API is running" });
});

app.use(profileRoutes);
app.use(equipmentRoutes);
app.use(ownerEquipmentRoutes);
app.use(favoritesRoutes);
app.use(bookingRoutes);
app.use(adminRoutes);
app.use(analyticsRoutes);
app.use(reviewRoutes);

// 404 for unknown routes
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// Central error handler
app.use((err, req, res, next) => {
  console.error(err);
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Invalid JSON body" });
  }
  res.status(500).json({ message: "Internal server error" });
});

const port = process.env.PORT || 5000;

connectDB()
  .then(() => {
    startBookingJobs();
    app.listen(port, () => console.log(`Server running on port ${port}`));
  })
  .catch((err) => {
    console.error("Failed to start server:", err.message);
    process.exit(1);
  });
