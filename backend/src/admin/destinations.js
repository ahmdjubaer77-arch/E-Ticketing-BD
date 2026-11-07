import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import Destination from "../models/Destination.js";
import { sanitizeText } from "../auth/security.js";
import { deleteCloudinaryImage, detectImageContentType, uploadCloudinaryImage } from "../media/cloudinary.js";

function destinationResponse(destination) {
  return {
    id: String(destination._id),
    name: destination.name,
    image: destination.image || "",
    createdAt: destination.createdAt,
  };
}

function normalizeDestinationKey(name) {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase("en");
}

export function validateDestinationName(value) {
  if (typeof value !== "string") {
    return { error: "Destination name is required.", name: "" };
  }
  const name = sanitizeText(value).replace(/\s+/g, " ").trim();
  if (name.length < 2 || name.length > 120) {
    return { error: "Destination name must be between 2 and 120 characters.", name };
  }
  return { error: "", name };
}

export function createAdminDestinationsRouter(config) {
  const router = Router();
  const imageLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_request, response) => response.status(429).json({ success: false, message: "Too many destination cover changes. Please try again later." }),
  });

  router.get("/", async (_request, response, next) => {
    try {
      const destinations = await Destination.find({ active: true })
        .select("name image createdAt")
        .sort({ name: 1, _id: 1 })
        .lean();
      return response.json({
        success: true,
        message: "Destinations retrieved.",
        data: { destinations: destinations.map(destinationResponse) },
      });
    } catch (error) {
      return next(error);
    }
  });

  router.post("/cover", imageLimiter, async (request, response, next) => {
    try {
      const { error, name } = validateDestinationName(request.query.name);
      if (error) return response.status(400).json({ success: false, message: error });
      const buffer = request.body;
      const contentType = detectImageContentType(buffer, request.get("content-type"));
      if (!contentType) {
        return response.status(Buffer.isBuffer(buffer) && buffer.length ? 415 : 400)
          .json({ success: false, message: "Upload a valid JPEG, PNG, or WebP cover image." });
      }
      if (buffer.length > 2 * 1024 * 1024) {
        return response.status(413).json({ success: false, message: "Destination cover images must be 2 MB or smaller." });
      }

      const nameKey = normalizeDestinationKey(name);
      const destination = await Destination.findOneAndUpdate(
        { nameKey },
        { $setOnInsert: { name, nameKey, active: true } },
        { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
      ).select("+imagePublicId");
      const uploaded = await uploadCloudinaryImage(config, {
        buffer,
        contentType,
        publicId: `destinations/${destination.id}/cover`,
      });
      destination.image = uploaded.secureUrl;
      destination.imagePublicId = uploaded.publicId;
      await destination.save();
      return response.json({
        success: true,
        message: "Destination cover uploaded.",
        data: { destination: destinationResponse(destination) },
      });
    } catch (error) {
      return next(error);
    }
  });

  router.delete("/cover", imageLimiter, async (request, response, next) => {
    try {
      const { error, name } = validateDestinationName(request.query.name);
      if (error) return response.status(400).json({ success: false, message: error });
      const destination = await Destination.findOne({ nameKey: normalizeDestinationKey(name), active: true })
        .select("+imagePublicId");
      if (!destination) return response.status(404).json({ success: false, message: "Destination not found." });
      if (destination.imagePublicId) await deleteCloudinaryImage(config, destination.imagePublicId);
      destination.image = "";
      destination.imagePublicId = "";
      await destination.save();
      return response.json({
        success: true,
        message: "Destination cover removed.",
        data: { destination: destinationResponse(destination) },
      });
    } catch (error) {
      return next(error);
    }
  });

  router.post("/", async (request, response, next) => {
    try {
      const { error, name } = validateDestinationName(request.body?.name);
      if (error) {
        return response.status(400).json({ success: false, message: error, errors: { name: error } });
      }
      const destination = await Destination.create({ name });
      return response.status(201).json({
        success: true,
        message: "Destination added.",
        data: { destination: destinationResponse(destination) },
      });
    } catch (error) {
      if (error?.code === 11000) {
        return response.status(409).json({
          success: false,
          message: "This destination already exists.",
          errors: { name: "This destination already exists." },
        });
      }
      return next(error);
    }
  });

  return router;
}
