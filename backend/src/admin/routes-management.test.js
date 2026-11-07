import test from "node:test";
import assert from "node:assert/strict";
import { isRouteObjectId, validateFeaturedRouteIds, validateRouteFields } from "./routes-management.js";
import Route from "../models/Route.js";

const validRoute = {
  departure: "  Dhaka ",
  destination: "Chattogram  ",
  distanceKm: 245.5,
  estimatedDurationMinutes: 360,
  transport: "Bus",
  startingFare: 650,
  description: "Intercity service",
  status: "active",
};

test("route validation trims locations and accepts valid route values", () => {
  const { errors, values } = validateRouteFields(validRoute, { creating: true });

  assert.deepEqual(errors, {});
  assert.equal(values.departure, "Dhaka");
  assert.equal(values.destination, "Chattogram");
  assert.equal(values.estimatedDurationMinutes, 360);
  assert.equal(values.startingFare, 650);
});

test("route validation rejects same locations, invalid numbers, transport, status, and extra fields", () => {
  const invalid = validateRouteFields({
    ...validRoute,
    destination: "dhaka",
    distanceKm: "245",
    estimatedDurationMinutes: 1.5,
    startingFare: -1,
    transport: "Air",
    status: "pending",
  }, { creating: true });

  assert.match(invalid.errors.destination, /must be different/);
  assert.match(invalid.errors.distanceKm, /must be a number/);
  assert.match(invalid.errors.estimatedDurationMinutes, /whole number/);
  assert.match(invalid.errors.startingFare, /must be a number/);
  assert.match(invalid.errors.transport, /Bus, Train, Launch, or Event/);
  assert.match(invalid.errors.status, /active or inactive/);
  assert.match(
    validateRouteFields({ ...validRoute, deletedAt: new Date() }, { creating: true }).errors.body,
    /Unsupported fields/,
  );
});

test("route updates require supported fields and cannot change status directly", () => {
  assert.match(
    validateRouteFields({}, { creating: false }).errors.body,
    /at least one route field/,
  );
  assert.match(
    validateRouteFields({ status: "inactive" }, { creating: false }).errors.body,
    /Unsupported fields/,
  );
});

test("homepage route selection accepts at most six unique valid route IDs", () => {
  const ids = [
    "507f1f77bcf86cd799439011",
    "507f1f77bcf86cd799439012",
    "507f1f77bcf86cd799439013",
    "507f1f77bcf86cd799439014",
    "507f1f77bcf86cd799439015",
    "507f1f77bcf86cd799439016",
  ];
  assert.deepEqual(validateFeaturedRouteIds(ids), { error: "", routeIds: ids });
  assert.match(validateFeaturedRouteIds([...ids, "507f1f77bcf86cd799439017"]).error, /no more than 6/);
  assert.match(validateFeaturedRouteIds([ids[0], ids[0]]).error, /only be selected once/);
  assert.match(validateFeaturedRouteIds(["not-an-id"]).error, /valid route ID/);
});

test("route IDs must be MongoDB ObjectId-shaped and model enforces numeric ranges", async () => {
  assert.equal(isRouteObjectId("507f1f77bcf86cd799439011"), true);
  assert.equal(isRouteObjectId("507f1f77bcf86cd79943901g"), false);
  assert.equal(isRouteObjectId("route-1"), false);

  const route = new Route({
    ...validRoute,
    distanceKm: 0,
    estimatedDurationMinutes: 0,
    startingFare: -1,
  });
  await assert.rejects(route.validate(), (error) => {
    assert.ok(error.errors.distanceKm);
    assert.ok(error.errors.estimatedDurationMinutes);
    assert.ok(error.errors.startingFare);
    return true;
  });
});
