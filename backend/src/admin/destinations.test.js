import test from "node:test";
import assert from "node:assert/strict";
import { validateDestinationName } from "./destinations.js";

test("destination names are trimmed and internal whitespace is normalized", () => {
  assert.deepEqual(validateDestinationName("  Saint   Martin  "), {
    error: "",
    name: "Saint Martin",
  });
});

test("destination names must be strings between 2 and 120 characters", () => {
  assert.match(validateDestinationName("").error, /between 2 and 120/);
  assert.match(validateDestinationName("A").error, /between 2 and 120/);
  assert.match(validateDestinationName("x".repeat(121)).error, /between 2 and 120/);
  assert.match(validateDestinationName(null).error, /required/);
});
