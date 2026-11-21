import jwt from "jsonwebtoken";
import { getDB } from "../db.js";

// Reads "Authorization: Bearer <token>", verifies the JWT and loads the user.
// The role always comes from the database, never from the token.
export async function verifyToken(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: "Unauthorized: token missing" });

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ message: "Unauthorized: invalid or expired token" });
  }

  const email = typeof payload.email === "string" ? payload.email : null;
  if (!email) return res.status(401).json({ message: "Unauthorized: invalid token" });

  const user = await getDB().collection("user").findOne({ email });
  if (!user) return res.status(401).json({ message: "Unauthorized: user not found" });

  req.user = {
    id: String(user._id),
    email: user.email,
    name: user.name,
    image: user.image || "",
    role: user.role || "customer",
  };
  next();
}

const requireRole =
  (...roles) =>
  (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ message: `Forbidden: ${roles.join(" / ")} access only` });
    }
    next();
  };

// Use as: router.get("/path", ...verifyAdmin, handler)
export const verifyRenter = [verifyToken, requireRole("customer")];
export const verifyOwner = [verifyToken, requireRole("owner")];
export const verifyAdmin = [verifyToken, requireRole("admin")];
