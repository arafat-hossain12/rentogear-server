import { Router } from "express";
import { getDB } from "../db.js";
import { verifyAdmin } from "../middleware/auth.js";
import {
  EQUIPMENT_STATUSES,
  ROLES,
  escapeRegex,
  getPaging,
  isValidId,
  oid,
  userFilter,
} from "../utils.js";

const router = Router();

const pages = (total, limit) => Math.max(Math.ceil(total / limit), 1);

// ---- Users ----------------------------------------------------------------

router.get("/admin/users", ...verifyAdmin, async (req, res) => {
  const { page, limit, skip } = getPaging(req.query, 10);
  const col = getDB().collection("user");
  const [total, rows] = await Promise.all([
    col.countDocuments({}),
    col.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
  ]);
  const items = rows.map((u) => ({
    id: String(u._id),
    name: u.name,
    email: u.email,
    image: u.image || "",
    role: u.role || "customer",
    createdAt: u.createdAt,
  }));
  res.json({ items, total, page, limit, pages: pages(total, limit) });
});

router.patch("/admin/users/:id/role", ...verifyAdmin, async (req, res) => {
  const { role } = req.body || {};
  if (!ROLES.includes(role)) return res.status(400).json({ message: "Invalid role" });
  if (req.params.id === req.user.id)
    return res.status(400).json({ message: "You cannot change your own role" });

  const result = await getDB()
    .collection("user")
    .updateOne(userFilter(req.params.id), { $set: { role, updatedAt: new Date() } });
  if (!result.matchedCount) return res.status(404).json({ message: "User not found" });
  res.json({ message: "Role updated", role });
});

router.delete("/admin/users/:id", ...verifyAdmin, async (req, res) => {
  if (req.params.id === req.user.id)
    return res.status(400).json({ message: "You cannot delete your own account" });

  const db = getDB();
  const user = await db.collection("user").findOne(userFilter(req.params.id));
  if (!user) return res.status(404).json({ message: "User not found" });

  const ids = [String(user._id), user._id];
  await db.collection("session").deleteMany({ userId: { $in: ids } });
  await db.collection("account").deleteMany({ userId: { $in: ids } });
  await db.collection("favorites").deleteMany({ userEmail: user.email });

  const owned = await db
    .collection("equipment")
    .find({ "owner.email": user.email })
    .project({ _id: 1 })
    .toArray();
  if (owned.length) {
    const ownedIds = owned.map((e) => e._id);
    await db.collection("favorites").deleteMany({ equipmentId: { $in: ownedIds } });
    await db.collection("equipment").deleteMany({ _id: { $in: ownedIds } });
  }

  await db.collection("user").deleteOne({ _id: user._id });
  res.json({ message: "User deleted" });
});

// ---- Equipment ----------------------------------------------------------------

router.get("/admin/equipment", ...verifyAdmin, async (req, res) => {
  const { page, limit, skip } = getPaging(req.query, 10);
  const filter = {};
  if (EQUIPMENT_STATUSES.includes(req.query.status)) filter.status = req.query.status;
  if (typeof req.query.q === "string" && req.query.q.trim()) {
    filter.name = new RegExp(escapeRegex(req.query.q.trim()), "i");
  }
  const col = getDB().collection("equipment");
  const [total, items] = await Promise.all([
    col.countDocuments(filter),
    col.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
  ]);
  res.json({ items, total, page, limit, pages: pages(total, limit) });
});

// Approve / reject (or move back to pending)
router.patch("/admin/equipment/:id/status", ...verifyAdmin, async (req, res) => {
  const { status } = req.body || {};
  if (!EQUIPMENT_STATUSES.includes(status))
    return res.status(400).json({ message: "Invalid status" });
  if (!isValidId(req.params.id)) return res.status(404).json({ message: "Equipment not found" });

  const result = await getDB()
    .collection("equipment")
    .updateOne({ _id: oid(req.params.id) }, { $set: { status, updatedAt: new Date() } });
  if (!result.matchedCount) return res.status(404).json({ message: "Equipment not found" });
  res.json({ message: `Equipment ${status}`, status });
});

// ---- Rentals ----------------------------------------------------------------

router.get("/admin/rentals", ...verifyAdmin, async (req, res) => {
  const { page, limit, skip } = getPaging(req.query, 10);
  const filter = {};
  if (req.query.payment === "paid") filter.paymentStatus = "paid";
  const col = getDB().collection("bookings");
  const [total, items] = await Promise.all([
    col.countDocuments(filter),
    col.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
  ]);
  res.json({ items, total, page, limit, pages: pages(total, limit) });
});

export default router;
