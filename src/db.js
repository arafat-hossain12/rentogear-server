import { MongoClient } from "mongodb";

const client = new MongoClient(process.env.MONGODB_URI);
let db;

export async function connectDB() {
  if (db) return db;
  await client.connect();
  db = client.db(process.env.MONGODB_DB || "rentogear");

  // Indexes used by the API (safe to run on every start)
  await db
    .collection("favorites")
    .createIndex({ userEmail: 1, equipmentId: 1 }, { unique: true });
  await db.collection("bookings").createIndex({ stripeSessionId: 1 });
  await db.collection("equipment").createIndex({ status: 1, createdAt: -1 });

  console.log("MongoDB connected");
  return db;
}

export function getDB() {
  if (!db) throw new Error("Database not connected");
  return db;
}
