import cron from "node-cron";
import { getDB } from "../db.js";
import { startOfTodayUTC } from "../utils.js";

// Marks paid bookings as "completed" once the rental end date has passed,
// and removes checkout attempts that were never paid for (older than 24h).
export async function runBookingJobs() {
  const db = getDB();

  const done = await db.collection("bookings").updateMany(
    { bookingStatus: "confirmed", endDate: { $lt: startOfTodayUTC() } },
    { $set: { bookingStatus: "completed", completedAt: new Date() } }
  );

  const abandoned = await db.collection("bookings").deleteMany({
    paymentStatus: "unpaid",
    createdAt: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
  });

  if (done.modifiedCount || abandoned.deletedCount) {
    console.log(
      `[cron] completed ${done.modifiedCount} booking(s), removed ${abandoned.deletedCount} unpaid booking(s)`
    );
  }
}

export function startBookingJobs() {
  // every hour, plus once right after the server starts
  cron.schedule("0 * * * *", () => {
    runBookingJobs().catch((err) => console.error("[cron] failed:", err.message));
  });
  runBookingJobs().catch((err) => console.error("[cron] failed:", err.message));
}
