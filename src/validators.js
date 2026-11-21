import { CATEGORIES, RENTAL_TYPES } from "./utils.js";

const str = (v) => (typeof v === "string" ? v.trim() : "");

function isHttpUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

// Validates the "Add / Update Equipment" body. Returns { data } or { error }.
export function validateEquipment(body = {}) {
  const data = {
    name: str(body.name),
    description: str(body.description),
    category: str(body.category),
    location: str(body.location),
    price: Number(body.price),
    rentalType: str(body.rentalType).toLowerCase(),
    quantity: Number(body.quantity),
    condition: str(body.condition),
    brand: str(body.brand),
    model: str(body.model),
    image: str(body.image),
    terms: str(body.terms),
  };

  if (data.name.length < 3 || data.name.length > 120)
    return { error: "Equipment name must be 3-120 characters" };
  if (data.description.length < 10 || data.description.length > 2000)
    return { error: "Description must be 10-2000 characters" };
  if (!CATEGORIES.includes(data.category))
    return { error: "Please choose a valid category" };
  if (data.location.length < 2 || data.location.length > 120)
    return { error: "Location is required" };
  if (!Number.isFinite(data.price) || data.price <= 0)
    return { error: "Rental price must be greater than 0" };
  if (!RENTAL_TYPES.includes(data.rentalType))
    return { error: "Rental type must be daily, weekly or monthly" };
  if (!Number.isInteger(data.quantity) || data.quantity < 1 || data.quantity > 10000)
    return { error: "Available quantity must be a whole number of at least 1" };
  if (!data.condition) return { error: "Equipment condition is required" };
  if (!data.brand) return { error: "Brand is required" };
  if (!data.model) return { error: "Model is required" };
  if (!isHttpUrl(data.image)) return { error: "A valid equipment image URL is required" };
  if (data.terms.length < 5) return { error: "Rental terms and conditions are required" };

  return { data };
}

export function validateProfile(body = {}) {
  const out = {};
  if (body.name !== undefined) {
    const name = str(body.name);
    if (name.length < 2 || name.length > 80) return { error: "Name must be 2-80 characters" };
    out.name = name;
  }
  if (body.image !== undefined) {
    const image = str(body.image);
    if (image && !isHttpUrl(image)) return { error: "Profile image must be a valid URL" };
    out.image = image;
  }
  if (body.phone !== undefined) {
    const phone = str(body.phone);
    if (phone && !/^[0-9+\-\s()]{7,20}$/.test(phone)) return { error: "Enter a valid phone number" };
    out.phone = phone;
  }
  if (body.address !== undefined) {
    const address = str(body.address);
    if (address.length > 200) return { error: "Address is too long" };
    out.address = address;
  }
  if (Object.keys(out).length === 0) return { error: "Nothing to update" };
  return { data: out };
}
