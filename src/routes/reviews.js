import { Router } from "express";
import { getDB } from "../db.js";

const router = Router();

// Public: customer reviews for the home page
router.get("/reviews", async (req, res) => {
  const items = await getDB()
    .collection("reviews")
    .find({})
    .sort({ createdAt: -1 })
    .limit(8)
    .toArray();
  res.json(items);
});

export default router;
