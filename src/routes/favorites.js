import { Router } from "express";
import { getDB } from "../db.js";
import { verifyRenter } from "../middleware/auth.js";
import { isValidId, oid } from "../utils.js";

const router = Router();

// Customer: ids of favorites (used to colour the heart buttons)
router.get("/favorites/ids", ...verifyRenter, async (req, res) => {
  const rows = await getDB()
    .collection("favorites")
    .find({ userEmail: req.user.email })
    .project({ equipmentId: 1 })
    .toArray();
  res.json(rows.map((r) => String(r.equipmentId)));
});

// Customer: favorites table (joined with the equipment)
router.get("/favorites", ...verifyRenter, async (req, res) => {
  const rows = await getDB()
    .collection("favorites")
    .aggregate([
      { $match: { userEmail: req.user.email } },
      { $sort: { createdAt: -1 } },
      {
        $lookup: {
          from: "equipment",
          localField: "equipmentId",
          foreignField: "_id",
          as: "equipment",
        },
      },
      { $unwind: "$equipment" },
      { $project: { _id: 1, createdAt: 1, equipment: 1 } },
    ])
    .toArray();
  res.json(rows);
});

// Customer: add to favorites
router.post("/favorites/:equipmentId", ...verifyRenter, async (req, res) => {
  const { equipmentId } = req.params;
  if (!isValidId(equipmentId)) return res.status(400).json({ message: "Invalid equipment id" });

  const db = getDB();
  const item = await db.collection("equipment").findOne({ _id: oid(equipmentId), status: "approved" });
  if (!item) return res.status(404).json({ message: "Equipment not found" });

  await db.collection("favorites").updateOne(
    { userEmail: req.user.email, equipmentId: item._id },
    { $setOnInsert: { createdAt: new Date() } },
    { upsert: true }
  );
  res.status(201).json({ message: "Added to favorites" });
});

// Customer: remove from favorites
router.delete("/favorites/:equipmentId", ...verifyRenter, async (req, res) => {
  const { equipmentId } = req.params;
  if (!isValidId(equipmentId)) return res.status(400).json({ message: "Invalid equipment id" });

  await getDB()
    .collection("favorites")
    .deleteOne({ userEmail: req.user.email, equipmentId: oid(equipmentId) });
  res.json({ message: "Removed from favorites" });
});

export default router;
