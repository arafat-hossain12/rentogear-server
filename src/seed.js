// Usage: node --env-file=.env src/seed.js <owner-email>
// Adds sample approved equipment (owned by that user) and sample customer reviews.
// Re-running replaces the previously seeded sample data.
import { MongoClient } from "mongodb";

const ownerEmail = process.argv[2];
if (!ownerEmail) {
  console.log("Usage: node --env-file=.env src/seed.js <owner-email>");
  process.exit(1);
}

const img = (label, color) =>
  `https://placehold.co/800x500/${color}/ffffff.png?text=${encodeURIComponent(label)}`;

const items = [
  ["Mini Excavator 1.8T", "Construction Equipment", "Dhaka", 120, "daily", 3, "Kubota", "KX018-4", "1e3a5f", "Compact excavator ideal for trenching, foundations and landscaping jobs."],
  ["Concrete Mixer 350L", "Construction Equipment", "Chattogram", 35, "daily", 6, "Lutian", "LT350", "1e3a5f", "Portable drum mixer for small to medium concrete work, easy to move on site."],
  ["Mirrorless Camera Kit", "Photography Equipment", "Dhaka", 60, "daily", 4, "Sony", "A7 III", "5b2a86", "Full-frame mirrorless body with 24-70mm lens, two batteries and a carry bag."],
  ["Studio Lighting Set", "Photography Equipment", "Sylhet", 90, "weekly", 5, "Godox", "SL60W x3", "5b2a86", "Three-light continuous LED kit with softboxes and stands for portraits and product shoots."],
  ["Pickup Truck 1 Ton", "Vehicles & Transportation", "Khulna", 85, "daily", 2, "Toyota", "Hilux", "0f6b4f", "Reliable pickup for moving goods and equipment, fuel not included."],
  ["Cargo Van 12ft", "Vehicles & Transportation", "Dhaka", 380, "weekly", 2, "Suzuki", "Carry", "0f6b4f", "Enclosed cargo van for deliveries, house shifting and small business logistics."],
  ["Walk-Behind Power Tiller", "Agriculture Equipment", "Rajshahi", 28, "daily", 8, "Yanmar", "YTP-8", "7a4b12", "Diesel power tiller for quick soil preparation on small and medium farms."],
  ["Knapsack Sprayer 20L", "Agriculture Equipment", "Mymensingh", 120, "monthly", 15, "Honda", "WJR-20", "7a4b12", "Battery sprayer for pesticides and fertilizer, lightweight and easy to carry."],
  ["4K Projector", "Electronics", "Dhaka", 45, "daily", 6, "Epson", "EH-TW7100", "9a1f3d", "Bright 4K projector for presentations, training sessions and movie nights."],
  ["Gaming Laptop RTX", "Electronics", "Chattogram", 240, "weekly", 4, "ASUS", "ROG Strix G16", "9a1f3d", "High-performance laptop for video editing, rendering and demanding software."],
  ["Event Tent 20x40", "Event Equipment", "Dhaka", 150, "daily", 5, "Gazebo Pro", "T2040", "b45309", "Weatherproof marquee tent for weddings, fairs and outdoor corporate events."],
  ["PA Sound System", "Event Equipment", "Sylhet", 70, "daily", 7, "Yamaha", "Stagepas 600BT", "b45309", "Portable PA system with two speakers and microphones for events up to 300 guests."],
];

const reviews = [
  ["Nusrat Jahan", 5, "Booked a camera kit for a shoot and everything arrived clean and on time. Payment was smooth."],
  ["Imran Hossain", 5, "Found a mixer for our small build in minutes. The owner was helpful and the price was fair."],
  ["Farhana Akter", 4, "Great variety of equipment. The delivery address option saved me a trip."],
  ["Rafiq Ahmed", 5, "I list my power tillers here and bookings come in regularly. The dashboard makes tracking earnings easy."],
  ["Tanvir Alam", 4, "Clear rental terms and a secure checkout. Will use it again for our next event."],
];

const client = new MongoClient(process.env.MONGODB_URI);
try {
  await client.connect();
  const db = client.db(process.env.MONGODB_DB || "rentogear");

  const owner = await db.collection("user").findOne({ email: ownerEmail.toLowerCase() });
  if (!owner) {
    console.log(`No user found with email ${ownerEmail}. Register that account on the website first.`);
    process.exit(1);
  }

  await db.collection("equipment").deleteMany({ seeded: true });
  await db.collection("reviews").deleteMany({ seeded: true });

  const now = Date.now();
  const equipment = items.map(
    ([name, category, location, price, rentalType, quantity, brand, model, color, description], i) => ({
      name,
      description,
      category,
      location,
      price,
      rentalType,
      quantity,
      condition: i % 3 === 0 ? "Like new" : "Good",
      brand,
      model,
      image: img(name, color),
      terms:
        "Valid ID required at pickup. Equipment must be returned on time and in the same condition. Damage or loss is charged at repair or replacement cost.",
      status: "approved",
      owner: { name: owner.name, email: owner.email, image: owner.image || "" },
      seeded: true,
      createdAt: new Date(now - i * 3600 * 1000),
      updatedAt: new Date(now - i * 3600 * 1000),
    })
  );
  await db.collection("equipment").insertMany(equipment);

  await db.collection("reviews").insertMany(
    reviews.map(([name, rating, comment], i) => ({
      name,
      rating,
      comment,
      seeded: true,
      createdAt: new Date(now - i * 86400000),
    }))
  );

  console.log(`Seeded ${equipment.length} equipment items and ${reviews.length} reviews for ${owner.email}`);
} finally {
  await client.close();
}
