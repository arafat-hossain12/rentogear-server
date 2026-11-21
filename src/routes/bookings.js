import { Router } from "express";
import Stripe from "stripe";
import { getDB } from "../db.js";
import { verifyOwner, verifyRenter } from "../middleware/auth.js";
import {
  allowedOrigins,
  calcRental,
  getPaging,
  isValidId,
  oid,
  parseDateOnly,
  startOfTodayUTC,
} from "../utils.js";

const router = Router();

let stripeClient = null;
function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  if (!stripeClient) stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY);
  return stripeClient;
}

// Quantity still free for the given dates (only paid + confirmed bookings count)
async function remainingQuantity(equipment, start, end) {
  const rows = await getDB()
    .collection("bookings")
    .aggregate([
      {
        $match: {
          equipmentId: equipment._id,
          paymentStatus: "paid",
          bookingStatus: "confirmed",
          startDate: { $lte: end },
          endDate: { $gte: start },
        },
      },
      { $group: { _id: null, booked: { $sum: "$quantity" } } },
    ])
    .toArray();
  return equipment.quantity - (rows[0]?.booked || 0);
}

// Customer: confirm booking -> create a pending booking and a Stripe Checkout session
router.post("/bookings/checkout", ...verifyRenter, async (req, res) => {
  const stripe = getStripe();
  if (!stripe) return res.status(503).json({ message: "Payments are not configured on the server" });

  const { equipmentId, startDate, endDate, contact, address, notes } = req.body || {};
  const quantity = Number(req.body?.quantity);

  if (!isValidId(equipmentId)) return res.status(400).json({ message: "Invalid equipment" });

  const start = parseDateOnly(startDate);
  const end = parseDateOnly(endDate);
  if (!start || !end) return res.status(400).json({ message: "Please select valid rental dates" });
  if (start < startOfTodayUTC())
    return res.status(400).json({ message: "Start date cannot be in the past" });
  if (end < start)
    return res.status(400).json({ message: "End date must be on or after the start date" });
  if (!Number.isInteger(quantity) || quantity < 1)
    return res.status(400).json({ message: "Required quantity must be at least 1" });
  if (typeof contact !== "string" || !/^[0-9+\-\s()]{7,20}$/.test(contact.trim()))
    return res.status(400).json({ message: "Enter a valid contact number" });
  if (typeof address !== "string" || address.trim().length < 5)
    return res.status(400).json({ message: "Delivery address is required" });

  const db = getDB();
  const equipment = await db
    .collection("equipment")
    .findOne({ _id: oid(equipmentId), status: "approved" });
  if (!equipment) return res.status(404).json({ message: "Equipment not found" });

  const remaining = await remainingQuantity(equipment, start, end);
  if (quantity > remaining) {
    return res.status(409).json({
      message:
        remaining > 0
          ? `Only ${remaining} unit(s) available for those dates`
          : "This equipment is not available for the selected dates",
    });
  }

  const { days, units, amount } = calcRental(equipment.price, equipment.rentalType, start, end, quantity);

  const booking = {
    equipmentId: equipment._id,
    equipmentName: equipment.name,
    equipmentImage: equipment.image,
    ownerEmail: equipment.owner.email,
    ownerName: equipment.owner.name,
    customerEmail: req.user.email,
    customerName: req.user.name,
    startDate: start,
    endDate: end,
    days,
    units,
    quantity,
    contact: contact.trim(),
    address: address.trim(),
    notes: typeof notes === "string" ? notes.trim().slice(0, 500) : "",
    amount,
    paymentStatus: "unpaid",
    bookingStatus: "pending",
    createdAt: new Date(),
  };
  const { insertedId } = await db.collection("bookings").insertOne(booking);

  const origin = allowedOrigins().includes(req.headers.origin)
    ? req.headers.origin
    : allowedOrigins()[0];

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: req.user.email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: Math.round(amount * 100),
            product_data: {
              name: equipment.name,
              description: `${quantity} unit(s), ${startDate} to ${endDate} (${units} ${equipment.rentalType} period${units > 1 ? "s" : ""})`,
            },
          },
        },
      ],
      metadata: { bookingId: String(insertedId) },
      success_url: `${origin}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/payment/cancel`,
    });

    await db
      .collection("bookings")
      .updateOne({ _id: insertedId }, { $set: { stripeSessionId: session.id } });
    res.json({ url: session.url, bookingId: insertedId, amount });
  } catch (err) {
    await db.collection("bookings").deleteOne({ _id: insertedId });
    console.error("Stripe error:", err.message);
    res.status(502).json({ message: "Could not start the payment. Please try again." });
  }
});

// Customer: called from the payment success page; marks the booking paid and records the payment
router.post("/bookings/confirm", ...verifyRenter, async (req, res) => {
  const stripe = getStripe();
  if (!stripe) return res.status(503).json({ message: "Payments are not configured on the server" });

  const sessionId = req.body?.sessionId;
  if (typeof sessionId !== "string" || !sessionId.startsWith("cs_"))
    return res.status(400).json({ message: "Invalid payment session" });

  const db = getDB();
  const booking = await db
    .collection("bookings")
    .findOne({ stripeSessionId: sessionId, customerEmail: req.user.email });
  if (!booking) return res.status(404).json({ message: "Booking not found" });

  if (booking.paymentStatus === "paid") return res.json(booking); // already confirmed

  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch {
    return res.status(502).json({ message: "Could not verify the payment" });
  }
  if (session.payment_status !== "paid")
    return res.status(402).json({ message: "Payment has not been completed" });

  const paidAt = new Date();
  const result = await db
    .collection("bookings")
    .updateOne(
      { _id: booking._id, paymentStatus: "unpaid" },
      { $set: { paymentStatus: "paid", bookingStatus: "confirmed", paidAt } }
    );

  if (result.modifiedCount === 1) {
    await db.collection("payments").updateOne(
      { sessionId },
      {
        $setOnInsert: {
          bookingId: booking._id,
          sessionId,
          transactionId:
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : session.payment_intent?.id || null,
          amount: (session.amount_total || 0) / 100,
          currency: session.currency,
          customerEmail: booking.customerEmail,
          ownerEmail: booking.ownerEmail,
          equipmentName: booking.equipmentName,
          status: "paid",
          paidAt,
        },
      },
      { upsert: true }
    );
  }

  const updated = await db.collection("bookings").findOne({ _id: booking._id });
  res.json(updated);
});

// Customer: My Rentals (paginated booking history)
router.get("/bookings/mine", ...verifyRenter, async (req, res) => {
  const { page, limit, skip } = getPaging(req.query, 10);
  const filter = { customerEmail: req.user.email };
  const col = getDB().collection("bookings");
  const [total, items] = await Promise.all([
    col.countDocuments(filter),
    col.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
  ]);
  res.json({ items, total, page, limit, pages: Math.max(Math.ceil(total / limit), 1) });
});

// Owner: rentals of my equipment (paid bookings only)
router.get("/owner/rentals", ...verifyOwner, async (req, res) => {
  const { page, limit, skip } = getPaging(req.query, 10);
  const filter = { ownerEmail: req.user.email, paymentStatus: "paid" };
  const col = getDB().collection("bookings");
  const [total, items] = await Promise.all([
    col.countDocuments(filter),
    col.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
  ]);
  res.json({ items, total, page, limit, pages: Math.max(Math.ceil(total / limit), 1) });
});

export default router;
