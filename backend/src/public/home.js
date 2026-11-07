import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import Offer from "../models/Offer.js";
import Route from "../models/Route.js";
import Destination from "../models/Destination.js";
import HomepageSettings from "../models/HomepageSettings.js";
import { createPublicSchedulesRouter } from "./schedules.js";

const activeRoutes = { status: "active", deletedAt: null };

export function collectHomeLocations(departures, arrivals, customDestinations) {
  const locationsByKey = new Map();
  for (const name of [...departures, ...arrivals, ...customDestinations.map(({ name }) => name)]) {
    const normalized = name.trim().replace(/\s+/g, " ");
    const key = normalized.toLocaleLowerCase("en");
    if (normalized && !locationsByKey.has(key)) locationsByKey.set(key, normalized);
  }
  return [...locationsByKey.values()].sort((a, b) => a.localeCompare(b));
}

export function createDestinationCoverMap(destinations) {
  return new Map(destinations.map(({ name, nameKey, image }) => [
    nameKey || name.trim().replace(/\s+/g, " ").toLocaleLowerCase("en"),
    image || "",
  ]));
}

export function orderFeaturedRoutes(routes, featuredRouteIds) {
  const routesById = new Map(routes.map((route) => [String(route._id), route]));
  return featuredRouteIds.map((id) => routesById.get(String(id))).filter(Boolean);
}

export function publicRouteResponse(route, image = "") {
  return {
    id: String(route._id),
    departure: route.departure,
    destination: route.destination,
    transport: route.transport,
    distanceKm: route.distanceKm,
    estimatedDurationMinutes: route.estimatedDurationMinutes,
    startingFare: route.startingFare,
    image,
  };
}

export function publicOfferResponse(offer) {
  return {
    id: String(offer._id),
    operator: offer.operator,
    from: offer.from,
    to: offer.to,
    transport: offer.transport,
    mode: offer.transport,
    originalPrice: offer.originalPrice,
    discountedPrice: offer.discountedPrice,
    discountLabel: offer.discountLabel || "",
    validity: offer.validity || "",
    validUntil: offer.validUntil,
    image: offer.image || "",
    imageAlt: offer.imageAlt || "",
  };
}

export function createPublicHomeRouter() {
  const router = Router();
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 120,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  });

  router.use("/schedules", createPublicSchedulesRouter());

  router.get("/home", limiter, async (_request, response, next) => {
    try {
      const [featuredSettings, destinations, departures, arrivals, customDestinations, offers] = await Promise.all([
        HomepageSettings.findById("homepage").select("featuredRouteIds").lean(),
        Route.aggregate([
          { $match: activeRoutes },
          { $sort: { startingFare: 1, departure: 1 } },
          {
            $group: {
              _id: "$destination",
              startingFare: { $first: "$startingFare" },
              departure: { $first: "$departure" },
              transport: { $first: "$transport" },
              routeCount: { $sum: 1 },
            },
          },
          { $sort: { startingFare: 1, _id: 1 } },
          { $limit: 8 },
        ]),
        Route.distinct("departure", activeRoutes),
        Route.distinct("destination", activeRoutes),
        Destination.find({ active: true }).select("name image nameKey").sort({ name: 1 }).lean(),
        Offer.find({
          status: "active",
          deletedAt: null,
          image: { $ne: "" },
          $or: [{ validUntil: null }, { validUntil: { $gte: new Date() } }],
        })
          .select("operator from to transport originalPrice discountedPrice discountLabel validity validUntil image imageAlt")
          .sort({ createdAt: -1, _id: -1 })
          .limit(12)
          .lean(),
      ]);
      const featuredRouteIds = (featuredSettings?.featuredRouteIds || []).map(String);
      const featuredRoutes = featuredRouteIds.length
        ? await Route.find({ ...activeRoutes, _id: { $in: featuredRouteIds } })
          .select("departure destination transport distanceKm estimatedDurationMinutes startingFare")
          .lean()
        : [];
      const routes = orderFeaturedRoutes(featuredRoutes, featuredRouteIds);
      const locations = collectHomeLocations(departures, arrivals, customDestinations);
      const destinationImages = createDestinationCoverMap(customDestinations);

      return response.json({
        success: true,
        message: "Homepage travel information retrieved.",
        data: {
          routes: routes.map((route) => publicRouteResponse(
            route,
            destinationImages.get(String(route.destination).trim().replace(/\s+/g, " ").toLocaleLowerCase("en")) || "",
          )),
          destinations: destinations.map(({ _id, startingFare, departure, transport, routeCount }) => ({
            name: _id,
            departure,
            transport,
            startingFare,
            routeCount,
            image: destinationImages.get(String(_id).trim().replace(/\s+/g, " ").toLocaleLowerCase("en")) || "",
          })),
          locations,
          deals: offers.map(publicOfferResponse),
        },
      });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
