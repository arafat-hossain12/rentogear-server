import { ObjectId } from "mongodb";

export const CATEGORIES = [
  "Construction Equipment",
  "Photography Equipment",
  "Vehicles & Transportation",
  "Agriculture Equipment",
  "Electronics",
  "Event Equipment",
];

export const RENTAL_TYPES = ["daily", "weekly", "monthly"];
export const ROLES = ["customer", "owner", "admin"];
export const EQUIPMENT_STATUSES = ["pending", "approved", "rejected"];

export const isValidId = (id) =>
  typeof id === "string" && /^[a-f\d]{24}$/i.test(id);

export const oid = (id) => new ObjectId(id);

export const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function toInt(value, fallback) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

// page / limit helper for list endpoints
export function getPaging(query, defaultLimit = 10) {
  const page = Math.max(toInt(query.page, 1), 1);
  const limit = Math.min(Math.max(toInt(query.limit, defaultLimit), 1), 50);
  return { page, limit, skip: (page - 1) * limit };
}

// "YYYY-MM-DD" -> Date at UTC midnight (null if invalid)
export function parseDateOnly(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function startOfTodayUTC() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

const round2 = (n) => Math.round(n * 100) / 100;

// total = price x rental units x quantity
export function calcRental(price, rentalType, start, end, quantity) {
  const days = Math.round((end - start) / 86400000) + 1; // inclusive
  let units = days;
  if (rentalType === "weekly") units = Math.ceil(days / 7);
  if (rentalType === "monthly") units = Math.ceil(days / 30);
  return { days, units, amount: round2(price * units * quantity) };
}

export function allowedOrigins() {
  return (process.env.CLIENT_URL || "http://localhost:3000")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// last N months as "YYYY-MM" (oldest first)
export function lastMonths(n) {
  const out = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

export function monthStartUTC(monthsBack) {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsBack, 1));
}

// filter that matches a BetterAuth user by its id (ObjectId or string)
export function userFilter(id) {
  return isValidId(id) ? { $or: [{ _id: oid(id) }, { id }] } : { id };
}
