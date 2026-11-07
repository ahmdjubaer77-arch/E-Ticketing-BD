import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import mongoose from "mongoose";
import { sanitizeText } from "../auth/security.js";
import Offer from "../models/Offer.js";
import { deleteCloudinaryImage, detectImageContentType, uploadCloudinaryImage } from "../media/cloudinary.js";

const transports = new Set(["Bus", "Train", "Launch", "Event"]);
const statuses = new Set(["active", "inactive"]);
const createFields = new Set([
  "operator", "from", "to", "transport", "originalPrice", "discountedPrice",
  "discountLabel", "validity", "validUntil", "imageAlt", "status",
]);
const updateFields = new Set(createFields);
const offerFields = "operator from to transport originalPrice discountedPrice discountLabel validity validUntil image imageAlt status createdAt updatedAt";

function isOfferObjectId(value) {
  return typeof value === "string" && /^[a-f\d]{24}$/i.test(value);
}

function validateOfferFields(body, { creating }) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { errors: { body: "A JSON object is required." }, values: {} };
  }
  const allowedFields = creating ? createFields : updateFields;
  const unexpected = Object.keys(body).filter((key) => !allowedFields.has(key));
  if (unexpected.length) {
    return { errors: { body: `Unsupported fields: ${unexpected.join(", ")}.` }, values: {} };
  }

  const errors = {};
  const values = {};
  for (const field of ["operator", "from", "to"]) {
    if (!creating && !Object.hasOwn(body, field)) continue;
    values[field] = sanitizeText(body[field]).replace(/\s+/g, " ").trim();
    if (values[field].length < 2 || values[field].length > 120) {
      errors[field] = `${field === "operator" ? "Operator" : field === "from" ? "Departure" : "Destination"} must be between 2 and 120 characters.`;
    }
  }
  if (creating || Object.hasOwn(body, "transport")) {
    values.transport = body.transport;
    if (!transports.has(values.transport)) errors.transport = "Transport must be Bus, Train, Launch, or Event.";
  }
  for (const field of ["originalPrice", "discountedPrice"]) {
    if (!creating && !Object.hasOwn(body, field)) continue;
    values[field] = body[field];
    if (typeof values[field] !== "number" || !Number.isFinite(values[field]) || values[field] < 0 || values[field] > 100_000_000) {
      errors[field] = `${field === "originalPrice" ? "Original" : "Discounted"} price must be a number between 0 and 100,000,000.`;
    }
  }
  if (values.originalPrice !== undefined && values.discountedPrice !== undefined
    && values.discountedPrice >= values.originalPrice) {
    errors.discountedPrice = "Discounted price must be lower than the original price.";
  }
  for (const [field, maximum] of [["discountLabel", 40], ["validity", 120], ["imageAlt", 200]]) {
    if (!creating && !Object.hasOwn(body, field)) continue;
    values[field] = sanitizeText(body[field] ?? "").trim();
    if (values[field].length > maximum) errors[field] = `${field} must be ${maximum} characters or fewer.`;
  }
  if (creating || Object.hasOwn(body, "validUntil")) {
    if (body.validUntil === "" || body.validUntil === null || body.validUntil === undefined) {
      values.validUntil = null;
    } else if (typeof body.validUntil === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.validUntil)) {
      const date = new Date(`${body.validUntil}T23:59:59.999Z`);
      if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== body.validUntil) {
        errors.validUntil = "Enter a valid offer end date.";
      } else {
        values.validUntil = date;
      }
    } else {
      errors.validUntil = "Enter a valid offer end date.";
    }
  }
  if (creating && body.status !== undefined) {
    values.status = body.status;
    if (!statuses.has(values.status)) errors.status = "Status must be active or inactive.";
  }
  if (!creating && Object.hasOwn(body, "status")) {
    values.status = body.status;
    if (!statuses.has(values.status)) errors.status = "Status must be active or inactive.";
  }
  if (!creating && !Object.keys(body).length) errors.body = "Provide at least one offer field to update.";
  return { errors, values };
}

function offerResponse(offer) {
  return {
    id: String(offer._id),
    operator: offer.operator,
    from: offer.from,
    to: offer.to,
    transport: offer.transport,
    originalPrice: offer.originalPrice,
    discountedPrice: offer.discountedPrice,
    discountLabel: offer.discountLabel || "",
    validity: offer.validity || "",
    validUntil: offer.validUntil,
    image: offer.image || "",
    imageAlt: offer.imageAlt || "",
    status: offer.status,
    createdAt: offer.createdAt,
    updatedAt: offer.updatedAt,
  };
}

export function createAdminOffersRouter(config) {
  const router = Router();
  const imageLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  });

  router.post("/:id/image", imageLimiter, async (request, response, next) => {
    try {
      if (!isOfferObjectId(request.params.id)) {
        return response.status(400).json({ success: false, message: "Offer ID must be a valid MongoDB ObjectId." });
      }
      const buffer = request.body;
      const contentType = detectImageContentType(buffer, request.get("content-type"));
      if (!contentType) {
        return response.status(Buffer.isBuffer(buffer) && buffer.length ? 415 : 400)
          .json({ success: false, message: "Upload a valid JPEG, PNG, or WebP cover image." });
      }
      if (buffer.length > 2 * 1024 * 1024) {
        return response.status(413).json({ success: false, message: "Cover images must be 2 MB or smaller." });
      }
      const offer = await Offer.findOne({ _id: request.params.id, deletedAt: null }).select("+imagePublicId");
      if (!offer) return response.status(404).json({ success: false, message: "Offer not found." });
      const uploaded = await uploadCloudinaryImage(config, {
        buffer,
        contentType,
        publicId: `offers/${offer.id}/cover`,
      });
      offer.image = uploaded.secureUrl;
      offer.imagePublicId = uploaded.publicId;
      await offer.save();
      return response.json({ success: true, message: "Offer cover image uploaded.", data: { offer: offerResponse(offer) } });
    } catch (error) {
      return next(error);
    }
  });

  router.delete("/:id/image", imageLimiter, async (request, response, next) => {
    try {
      if (!isOfferObjectId(request.params.id)) {
        return response.status(400).json({ success: false, message: "Offer ID must be a valid MongoDB ObjectId." });
      }
      const offer = await Offer.findOne({ _id: request.params.id, deletedAt: null }).select("+imagePublicId");
      if (!offer) return response.status(404).json({ success: false, message: "Offer not found." });
      if (offer.imagePublicId) await deleteCloudinaryImage(config, offer.imagePublicId);
      offer.image = "";
      offer.imagePublicId = "";
      await offer.save();
      return response.json({ success: true, message: "Offer cover image removed.", data: { offer: offerResponse(offer) } });
    } catch (error) {
      return next(error);
    }
  });

  router.get("/", async (request, response, next) => {
    try {
      const search = typeof request.query.search === "string" ? sanitizeText(request.query.search).trim().slice(0, 120) : "";
      const page = request.query.page === undefined ? 1 : Number(request.query.page);
      const limit = request.query.limit === undefined ? 100 : Number(request.query.limit);
      if (!Number.isSafeInteger(page) || page < 1 || page > 1_000_000
        || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
        return response.status(400).json({ success: false, message: "Page must be positive and limit must be between 1 and 100." });
      }
      const filter = { deletedAt: null };
      if (search) {
        const pattern = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
        filter.$or = [{ operator: pattern }, { from: pattern }, { to: pattern }, { transport: pattern }];
      }
      const [offers, total] = await Promise.all([
        Offer.find(filter).select(offerFields).sort({ createdAt: -1, _id: -1 })
          .skip((page - 1) * limit).limit(limit).lean(),
        Offer.countDocuments(filter),
      ]);
      return response.json({
        success: true,
        message: "Offers retrieved.",
        data: { offers: offers.map(offerResponse), pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } },
      });
    } catch (error) {
      return next(error);
    }
  });

  router.post("/", async (request, response, next) => {
    try {
      const { errors, values } = validateOfferFields(request.body, { creating: true });
      if (Object.keys(errors).length) {
        return response.status(400).json({ success: false, message: "Please correct the highlighted fields.", errors });
      }
      const offer = await Offer.create({ ...values, status: values.status || "active" });
      return response.status(201).json({ success: true, message: "Offer created.", data: { offer: offerResponse(offer) } });
    } catch (error) {
      return next(error);
    }
  });

  router.put("/:id", async (request, response, next) => {
    try {
      if (!isOfferObjectId(request.params.id)) {
        return response.status(400).json({ success: false, message: "Offer ID must be a valid MongoDB ObjectId." });
      }
      const { errors, values } = validateOfferFields(request.body, { creating: false });
      if (Object.keys(errors).length) {
        return response.status(400).json({ success: false, message: "Please correct the highlighted fields.", errors });
      }
      const offer = await Offer.findOne({ _id: request.params.id, deletedAt: null });
      if (!offer) return response.status(404).json({ success: false, message: "Offer not found." });
      const nextOriginal = values.originalPrice ?? offer.originalPrice;
      const nextDiscounted = values.discountedPrice ?? offer.discountedPrice;
      if (nextDiscounted >= nextOriginal) {
        return response.status(400).json({
          success: false,
          message: "Please correct the highlighted fields.",
          errors: { discountedPrice: "Discounted price must be lower than the original price." },
        });
      }
      Object.assign(offer, values);
      await offer.save();
      return response.json({ success: true, message: "Offer updated.", data: { offer: offerResponse(offer) } });
    } catch (error) {
      return next(error);
    }
  });

  router.delete("/:id", async (request, response, next) => {
    try {
      if (!isOfferObjectId(request.params.id)) {
        return response.status(400).json({ success: false, message: "Offer ID must be a valid MongoDB ObjectId." });
      }
      const offer = await Offer.findOne({ _id: request.params.id, deletedAt: null }).select("+imagePublicId");
      if (!offer) return response.status(404).json({ success: false, message: "Offer not found." });
      if (offer.imagePublicId) await deleteCloudinaryImage(config, offer.imagePublicId);
      offer.deletedAt = new Date();
      offer.status = "inactive";
      await offer.save();
      return response.json({ success: true, message: "Offer deleted.", data: { offer: offerResponse(offer) } });
    } catch (error) {
      return next(error);
    }
  });

  router.get("/:id", async (request, response, next) => {
    try {
      if (!mongoose.isValidObjectId(request.params.id)) {
        return response.status(400).json({ success: false, message: "Offer ID must be a valid MongoDB ObjectId." });
      }
      const offer = await Offer.findOne({ _id: request.params.id, deletedAt: null }).select(offerFields).lean();
      if (!offer) return response.status(404).json({ success: false, message: "Offer not found." });
      return response.json({ success: true, message: "Offer retrieved.", data: { offer: offerResponse(offer) } });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

export { offerResponse, validateOfferFields };
