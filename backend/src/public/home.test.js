import test from "node:test";
import assert from "node:assert/strict";
import { publicOfferResponse, publicRouteResponse } from "./home.js";

test("public route response exposes only route fields needed by the home page", () => {
  const route = publicRouteResponse({
    _id: "507f1f77bcf86cd799439011",
    departure: "Dhaka",
    destination: "Sylhet",
    transport: "Bus",
    startingFare: 700,
    description: "Internal route notes",
    deletedAt: null,
    departureKey: "dhaka",
  });

  test("public offer response maps cover and pricing fields for the home page", () => {
    const response = publicOfferResponse({
      _id: "507f1f77bcf86cd799439011",
      operator: "Green Line",
      from: "Dhaka",
      to: "Chattogram",
      transport: "Bus",
      originalPrice: 2800,
      discountedPrice: 2600,
      discountLabel: "৳200 OFF",
      validity: "Selected trips",
      validUntil: null,
      image: "https://res.cloudinary.com/demo/offer.jpg",
      imageAlt: "Coach on a highway",
      status: "active",
    });

    assert.deepEqual(response, {
      id: "507f1f77bcf86cd799439011",
      operator: "Green Line",
      from: "Dhaka",
      to: "Chattogram",
      transport: "Bus",
      mode: "Bus",
      originalPrice: 2800,
      discountedPrice: 2600,
      discountLabel: "৳200 OFF",
      validity: "Selected trips",
      validUntil: null,
      image: "https://res.cloudinary.com/demo/offer.jpg",
      imageAlt: "Coach on a highway",
    });
  });

  assert.deepEqual(route, {
    id: "507f1f77bcf86cd799439011",
    departure: "Dhaka",
    destination: "Sylhet",
    transport: "Bus",
    startingFare: 700,
  });
});
