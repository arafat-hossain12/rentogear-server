import { Router } from "express";
import { getDB } from "../db.js";
import { verifyToken } from "../middleware/auth.js";
import { validateProfile } from "../validators.js";

const router = Router();

const publicUser = (u) => ({
  id: String(u._id),
  name: u.name,
  email: u.email,
  image: u.image || "",
  phone: u.phone || "",
  address: u.address || "",
  role: u.role || "customer",
  createdAt: u.createdAt,
});

// Current user (the client uses this to know the role)
router.get("/me", verifyToken, async (req, res) => {
  const user = await getDB().collection("user").findOne({ email: req.user.email });
  res.json(publicUser(user));
});

// Update own profile: name, image, phone, address
router.patch("/me", verifyToken, async (req, res) => {
  const { data, error } = validateProfile(req.body);
  if (error) return res.status(400).json({ message: error });

  await getDB()
    .collection("user")
    .updateOne({ email: req.user.email }, { $set: { ...data, updatedAt: new Date() } });

  const user = await getDB().collection("user").findOne({ email: req.user.email });
  res.json(publicUser(user));
});

export default router;
