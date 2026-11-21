import { Router } from "express";
import { getDB } from "../db.js";
import { verifyOwner, verifyToken } from "../middleware/auth.js";
import { getPaging, isValidId, oid } from "../utils.js";
import { validateEquipment } from "../validators.js";

const router = Router();

// Owner: add equipment (always starts as "pending" until an admin approves it)
router.post("/equipment", ...verifyOwner, async (req, res) => {
  const { data, error } = validateEquipment(req.body);
  if (error) return res.status(400).json({ message: error });

  const doc = {
    ...data,
    status: "pending",
    owner: { name: req.user.name, email: req.user.email, image: req.user.image },
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const result = await getDB().collection("equipment").insertOne(doc);
  res.status(201).json({ ...doc, _id: result.insertedId });
});

// Owner: my equipment table
router.get("/owner/equipment", ...verifyOwner, async (req, res) => {
  const { page, limit, skip } = getPaging(req.query, 10);
  const filter = { "owner.email": req.user.email };
  const col = getDB().collection("equipment");
  const [total, items] = await Promise.all([
    col.countDocuments(filter),
    col.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
  ]);
  res.json({ items, total, page, limit, pages: Math.max(Math.ceil(total / limit), 1) });
});

// Loads the equipment and checks that the caller owns it (or is an admin)
async function loadEditable(req, res) {
  if (!isValidId(req.params.id)) {
    res.status(404).json({ message: "Equipment not found" });
    return null;
  }
  const item = await getDB().collection("equipment").findOne({ _id: oid(req.params.id) });
  if (!item) {
    res.status(404).json({ message: "Equipment not found" });
    return null;
  }
  const allowed =
    req.user.role === "admin" ||
    (req.user.role === "owner" && item.owner?.email === req.user.email);
  if (!allowed) {
    res.status(403).json({ message: "Forbidden: you can only manage your own equipment" });
    return null;
  }
  return item;
}

// Owner (own items) or admin: update
router.put("/equipment/:id", verifyToken, async (req, res) => {
  const item = await loadEditable(req, res);
  if (!item) return;

  const { data, error } = validateEquipment(req.body);
  if (error) return res.status(400).json({ message: error });

  await getDB()
    .collection("equipment")
    .updateOne({ _id: item._id }, { $set: { ...data, updatedAt: new Date() } });
  res.json({ ...item, ...data });
});

// Owner (own items) or admin: delete
router.delete("/equipment/:id", verifyToken, async (req, res) => {
  const item = await loadEditable(req, res);
  if (!item) return;

  const db = getDB();
  await db.collection("equipment").deleteOne({ _id: item._id });
  await db.collection("favorites").deleteMany({ equipmentId: item._id });
  res.json({ message: "Equipment deleted" });
});

export default router;
