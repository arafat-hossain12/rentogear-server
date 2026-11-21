import { Router } from "express";
import { getDB } from "../db.js";
import { verifyToken } from "../middleware/auth.js";
import { CATEGORIES, escapeRegex, getPaging, isValidId, oid } from "../utils.js";

const router = Router();

const SORTS = {
  price_asc: { price: 1, _id: 1 },
  price_desc: { price: -1, _id: 1 },
  newest: { createdAt: -1, _id: -1 },
};

// Public: approved equipment with server-side search, filter, sort and pagination
router.get("/equipment", async (req, res) => {
  const filter = { status: "approved" };

  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    filter.$or = [{ name: rx }, { location: rx }, { category: rx }];
  }

  const category = typeof req.query.category === "string" ? req.query.category : "";
  if (category && category !== "all") filter.category = category;

  const rentalType = typeof req.query.rentalType === "string" ? req.query.rentalType : "";
  if (rentalType && rentalType !== "all") filter.rentalType = rentalType;

  const min = Number(req.query.minPrice);
  const max = Number(req.query.maxPrice);
  const price = {};
  if (req.query.minPrice !== undefined && req.query.minPrice !== "" && Number.isFinite(min))
    price.$gte = min;
  if (req.query.maxPrice !== undefined && req.query.maxPrice !== "" && Number.isFinite(max))
    price.$lte = max;
  if (Object.keys(price).length) filter.price = price;

  if (req.query.availability === "available") filter.quantity = { $gt: 0 };
  if (req.query.availability === "unavailable") filter.quantity = { $lte: 0 };

  const sort = SORTS[req.query.sort] || SORTS.newest;
  const { page, limit, skip } = getPaging(req.query, 9);

  const col = getDB().collection("equipment");
  const [total, items] = await Promise.all([
    col.countDocuments(filter),
    col.find(filter).sort(sort).skip(skip).limit(limit).toArray(),
  ]);

  res.json({ items, total, page, limit, pages: Math.max(Math.ceil(total / limit), 1) });
});

// Public: 6 latest approved items for the home page
router.get("/equipment/featured", async (req, res) => {
  const items = await getDB()
    .collection("equipment")
    .find({ status: "approved" })
    .sort({ createdAt: -1, _id: -1 })
    .limit(6)
    .toArray();
  res.json(items);
});

// Public: all categories with the number of approved items in each
router.get("/equipment/categories", async (req, res) => {
  const rows = await getDB()
    .collection("equipment")
    .aggregate([
      { $match: { status: "approved" } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
    ])
    .toArray();
  const counts = Object.fromEntries(rows.map((r) => [r._id, r.count]));
  res.json(CATEGORIES.map((name) => ({ name, count: counts[name] || 0 })));
});

// Private: details page (logged-in users only)
router.get("/equipment/:id", verifyToken, async (req, res) => {
  if (!isValidId(req.params.id)) return res.status(404).json({ message: "Equipment not found" });

  const item = await getDB().collection("equipment").findOne({ _id: oid(req.params.id) });
  if (!item) return res.status(404).json({ message: "Equipment not found" });

  const isOwner = item.owner?.email === req.user.email;
  if (item.status !== "approved" && !isOwner && req.user.role !== "admin") {
    return res.status(404).json({ message: "Equipment not found" });
  }
  res.json(item);
});

export default router;
