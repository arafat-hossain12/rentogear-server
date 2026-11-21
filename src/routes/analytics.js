import { Router } from "express";
import { getDB } from "../db.js";
import { verifyAdmin, verifyOwner } from "../middleware/auth.js";
import { lastMonths, monthStartUTC } from "../utils.js";

const router = Router();

const MONTHS = 6;

// Paid bookings grouped by month -> [{ month, bookings, revenue }] for the last 6 months
async function monthlyStats(extraMatch = {}) {
  const rows = await getDB()
    .collection("bookings")
    .aggregate([
      {
        $match: {
          paymentStatus: "paid",
          createdAt: { $gte: monthStartUTC(MONTHS - 1) },
          ...extraMatch,
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
          bookings: { $sum: 1 },
          revenue: { $sum: "$amount" },
        },
      },
    ])
    .toArray();
  const byMonth = Object.fromEntries(rows.map((r) => [r._id, r]));
  return lastMonths(MONTHS).map((month) => ({
    month,
    bookings: byMonth[month]?.bookings || 0,
    revenue: Math.round((byMonth[month]?.revenue || 0) * 100) / 100,
  }));
}

async function sumPayments(match = {}) {
  const rows = await getDB()
    .collection("payments")
    .aggregate([
      { $match: { status: "paid", ...match } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ])
    .toArray();
  return Math.round((rows[0]?.total || 0) * 100) / 100;
}

// Admin: whole-platform numbers from users, equipment, bookings and payments
router.get("/admin/analytics", ...verifyAdmin, async (req, res) => {
  const db = getDB();
  const [
    totalUsers,
    totalEquipment,
    totalBookings,
    pendingApprovals,
    completedRentals,
    totalRevenue,
    monthly,
    categoryRows,
    roleRows,
  ] = await Promise.all([
    db.collection("user").countDocuments({}),
    db.collection("equipment").countDocuments({}),
    db.collection("bookings").countDocuments({ paymentStatus: "paid" }),
    db.collection("equipment").countDocuments({ status: "pending" }),
    db.collection("bookings").countDocuments({ bookingStatus: "completed" }),
    sumPayments(),
    monthlyStats(),
    db
      .collection("equipment")
      .aggregate([{ $group: { _id: "$category", count: { $sum: 1 } } }])
      .toArray(),
    db
      .collection("user")
      .aggregate([{ $group: { _id: { $ifNull: ["$role", "customer"] }, count: { $sum: 1 } } }])
      .toArray(),
  ]);

  res.json({
    totalUsers,
    totalEquipment,
    totalBookings,
    pendingApprovals,
    completedRentals,
    totalRevenue,
    monthly,
    equipmentByCategory: categoryRows.map((r) => ({ name: r._id, count: r.count })),
    usersByRole: roleRows.map((r) => ({ role: r._id, count: r.count })),
  });
});

// Owner: my own rental business numbers
router.get("/owner/analytics", ...verifyOwner, async (req, res) => {
  const db = getDB();
  const email = req.user.email;
  const [totalEquipment, approvedEquipment, totalBookings, completedRentals, totalEarnings, monthly] =
    await Promise.all([
      db.collection("equipment").countDocuments({ "owner.email": email }),
      db.collection("equipment").countDocuments({ "owner.email": email, status: "approved" }),
      db.collection("bookings").countDocuments({ ownerEmail: email, paymentStatus: "paid" }),
      db.collection("bookings").countDocuments({ ownerEmail: email, bookingStatus: "completed" }),
      sumPayments({ ownerEmail: email }),
      monthlyStats({ ownerEmail: email }),
    ]);

  res.json({
    totalEquipment,
    approvedEquipment,
    totalBookings,
    completedRentals,
    totalEarnings,
    monthly: monthly.map((m) => ({ month: m.month, bookings: m.bookings, earnings: m.revenue })),
  });
});

export default router;
