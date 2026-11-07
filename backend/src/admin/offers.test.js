import test from "node:test";
import assert from "node:assert/strict";
import { offerResponse, validateOfferFields } from "./offers.js";

const validOffer = {
  operator: "Green Line Paribahan",
  from: "Dhaka",
  to: "Chattogram",
  transport: "Bus",
  originalPrice: 2800,
  discountedPrice: 2600,
  discountLabel: "৳200 OFF",
  validity: "Selected departures",
  validUntil: "2030-12-31",
  imageAlt: "Green Line coach",
  status: "active",
};

test("offer validation accepts valid create and parses optional expiry", () => {
  const { errors, values } = validateOfferFields(validOffer, { creating: true });

  assert.deepEqual(errors, {});
  assert.equal(values.operator, "Green Line Paribahan");
  assert.equal(values.validUntil.toISOString(), "2030-12-31T23:59:59.999Z");
  assert.equal(values.discountedPrice, 2600);
});

test("offer validation rejects non-discounted prices, unsupported transport and invalid date", () => {
  const { errors } = validateOfferFields({
    ...validOffer,
    transport: "Plane",
    originalPrice: 100,
    discountedPrice: 100,
    validUntil: "2030-02-30",
  }, { creating: true });

  assert.match(errors.transport, /Bus, Train, Launch, or Event/);
  assert.match(errors.discountedPrice, /lower than the original/);
  assert.match(errors.validUntil, /valid offer end date/);
});

test("offer updates accept visibility changes but reject unsupported fields", () => {
  assert.deepEqual(validateOfferFields({ status: "inactive" }, { creating: false }).values, { status: "inactive" });
  assert.match(validateOfferFields({ deletedAt: null }, { creating: false }).errors.body, /Unsupported fields/);
});

test("public offer response exposes only homepage offer fields", () => {
  const offer = offerResponse({
    _id: "507f1f77bcf86cd799439011",
    ...validOffer,
    validUntil: new Date("2030-12-31T23:59:59.999Z"),
    image: "https://res.cloudinary.com/demo/image/upload/offer.jpg",
    imagePublicId: "offers/private",
    deletedAt: null,
    createdAt: new Date("2030-01-01T00:00:00.000Z"),
  });

  assert.deepEqual(offer, {
    id: "507f1f77bcf86cd799439011",
    ...validOffer,
    validUntil: new Date("2030-12-31T23:59:59.999Z"),
    image: "https://res.cloudinary.com/demo/image/upload/offer.jpg",
    createdAt: new Date("2030-01-01T00:00:00.000Z"),
    updatedAt: undefined,
  });
});
