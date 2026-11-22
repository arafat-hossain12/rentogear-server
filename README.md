# RentoGear Server

REST API for **RentoGear**, an equipment rental marketplace where owners list equipment and customers browse, book and pay for rentals. Built with Express and MongoDB.

- **Live API:** https://rentogear-server.onrender.com
- **Live site:** https://rentogear-client.vercel.app
- **Client repository:** https://github.com/arafat-hossain12/rentogear-client

## Key features

- JWT verification with role-based middlewares: `verifyToken`, `verifyRenter`, `verifyOwner`, `verifyAdmin` (roles: customer, owner, admin; the role is always read from the database)
- Public equipment API with server-side search (name, location, category), filters (category, rental type, price range, availability), sorting and pagination
- Owner endpoints to add, update and delete equipment; new items stay `pending` until an admin approves them
- Booking flow with date and quantity validation, availability check, automatic total calculation and Stripe Checkout payment
- Payment confirmation that marks the booking paid and records the transaction in a `payments` collection
- Favorites for customers, stored in the database
- Admin tools: manage users and roles, approve / reject / update / delete equipment, monitor all rentals
- Dashboard analytics for admins (users, equipment, bookings, revenue, monthly stats) and owners (listed equipment, completed rentals, earnings)
- `node-cron` job that marks bookings as completed after the rental end date

## npm packages

`express`, `cors`, `dotenv`, `mongodb`, `jsonwebtoken`, `stripe`, `node-cron`

## Environment variables

Copy `.env.example` to `.env` and fill in the values. The `.env` file is git-ignored.

| Name | Purpose |
| --- | --- |
| `MONGODB_URI` | MongoDB connection string |
| `MONGODB_DB` | Database name (`rentogear`) |
| `JWT_SECRET` | Secret shared with the client for signing / verifying tokens |
| `CLIENT_URL` | Allowed client origin(s), comma separated |
| `STRIPE_SECRET_KEY` | Stripe secret key (test mode) |
| `PORT` | Port to listen on |

## Run locally

```bash
npm install
npm run dev
```

## Useful scripts

```bash
# give a registered user a role (admin, owner or customer)
node --env-file=.env src/make-admin.js user@example.com admin

# add sample equipment and reviews owned by a registered owner
node --env-file=.env src/seed.js owner@example.com
```

## API overview

| Method | Route | Access |
| --- | --- | --- |
| GET | `/equipment` | Public (search, filter, sort, pagination) |
| GET | `/equipment/featured`, `/equipment/categories` | Public |
| GET | `/equipment/:id` | Logged-in user |
| POST / PUT / DELETE | `/equipment`, `/equipment/:id` | Owner (own items) / Admin |
| GET | `/owner/equipment`, `/owner/rentals`, `/owner/analytics` | Owner |
| POST | `/bookings/checkout`, `/bookings/confirm` | Customer |
| GET | `/bookings/mine` | Customer |
| GET / POST / DELETE | `/favorites`, `/favorites/:equipmentId` | Customer |
| GET / PATCH | `/me` | Logged-in user |
| GET | `/admin/users`, `/admin/equipment`, `/admin/rentals`, `/admin/analytics` | Admin |
| PATCH / DELETE | `/admin/users/:id/role`, `/admin/users/:id`, `/admin/equipment/:id/status` | Admin |
| GET | `/reviews` | Public |
