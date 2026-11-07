import test from "node:test";
import assert from "node:assert/strict";
import { detectImageContentType, signCloudinaryParameters, uploadCloudinaryImage } from "./cloudinary.js";

test("validates image bytes against the declared image type", () => {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0x00]);
  assert.equal(detectImageContentType(jpeg, "image/jpeg"), "image/jpeg");
  assert.equal(detectImageContentType(jpeg, "image/png"), null);
  assert.equal(detectImageContentType(Buffer.alloc(0), "image/jpeg"), null);
});

test("signs Cloudinary parameters in a stable sorted form", () => {
  const first = signCloudinaryParameters({ timestamp: "123", public_id: "users/a/profile" }, "secret");
  const reordered = signCloudinaryParameters({ public_id: "users/a/profile", timestamp: "123" }, "secret");
  assert.equal(first, reordered);
  assert.match(first, /^[a-f\d]{40}$/);
});

test("returns a clear unavailable error when Cloudinary credentials are not configured", async () => {
  await assert.rejects(
    uploadCloudinaryImage({}, { buffer: Buffer.from("image"), contentType: "image/jpeg", publicId: "users/1/profile" }),
    (error) => error.statusCode === 503 && error.code === "MEDIA_STORAGE_NOT_CONFIGURED",
  );
});
