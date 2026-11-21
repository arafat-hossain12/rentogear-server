// Usage: node --env-file=.env src/make-admin.js <email> [role]
// role = admin (default) | owner | customer
import { MongoClient } from "mongodb";

const [email, role = "admin"] = process.argv.slice(2);

if (!email || !["admin", "owner", "customer"].includes(role)) {
  console.log("Usage: node --env-file=.env src/make-admin.js <email> [admin|owner|customer]");
  process.exit(1);
}

const client = new MongoClient(process.env.MONGODB_URI);
try {
  await client.connect();
  const db = client.db(process.env.MONGODB_DB || "rentogear");
  const result = await db
    .collection("user")
    .updateOne({ email: email.toLowerCase() }, { $set: { role } });
  if (!result.matchedCount) {
    console.log(`No user found with email ${email}. Register that account on the website first.`);
  } else {
    console.log(`Done: ${email} is now "${role}"`);
  }
} finally {
  await client.close();
}
