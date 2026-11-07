import test from "node:test";
import assert from "node:assert/strict";
import { collectHomeLocations, createDestinationCoverMap, orderFeaturedRoutes, publicOfferResponse, publicRouteResponse } from "./home.js";

test("homepage locations include admin-added destinations without case-insensitive duplicates", () => {
  assert.deepEqual(
    collectHomeLocations(["Dhaka"], ["Saint Martin"], [{ name: "  saint   martin " }, { name: "Benapole" }]),
    ["Benapole", "Dhaka", "Saint Martin"],
  );
});

test("destination cover lookup is case-insensitive and independent of route departure", () => {
  const covers = createDestinationCoverMap([{ name: "Barishal", nameKey: "barishal", image: "https://cdn.example.com/barishal.jpg" }]);
  const routes = [{ departure: "Dhaka", destination: "Barishal" }, { departure: "Tangail", destination: "Barishal" }];
  assert.deepEqual(routes.map(({ destination }) => covers.get(destination.toLocaleLowerCase("en"))), [
    "https://cdn.example.com/barishal.jpg",
    "https://cdn.example.com/barishal.jpg",
  ]);
});

test("homepage routes are returned only in the selected featured order", () => {
  const routes = [
    { _id: "route-b", departure: "Tangail", destination: "Barishal" },
    { _id: "route-a", departure: "Dhaka", destination: "Barishal" },
  ];
  assert.deepEqual(orderFeaturedRoutes(routes, ["route-a", "route-b", "missing"]), [routes[1], routes[0]]);
});

test("public route response exposes only route fields needed by the home page", () => {
  const route = publicRouteResponse({
    _id: "507f1f77bcf86cd799439011",
    departure: "Dhaka",
    destination: "Sylhet",
    transport: "Bus",
    distanceKm: 245,
    estimatedDurationMinutes: 360,
    startingFare: 700,
    description: "Internal route notes",
    deletedAt: null,
    departureKey: "dhaka",
  }, "https://cdn.example.com/sylhet.jpg");

  assert.deepEqual(route, {
    id: "507f1f77bcf86cd799439011",
    departure: "Dhaka",
    destination: "Sylhet",
    transport: "Bus",
    distanceKm: 245,
    estimatedDurationMinutes: 360,
    startingFare: 700,
    image: "https://cdn.example.com/sylhet.jpg",
  });
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
