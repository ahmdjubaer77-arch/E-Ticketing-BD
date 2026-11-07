import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import Offer from "../models/Offer.js";
import Route from "../models/Route.js";
import { createPublicSchedulesRouter } from "./schedules.js";

const activeRoutes = { status: "active", deletedAt: null };

export function publicRouteResponse(route) {
  return {
    id: String(route._id),
    departure: route.departure,
    destination: route.destination,
    transport: route.transport,
    startingFare: route.startingFare,
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
      const [routes, destinations, departures, arrivals, offers] = await Promise.all([
        Route.find(activeRoutes)
          .select("departure destination transport startingFare")
          .sort({ departure: 1, destination: 1, _id: 1 })
          .limit(8)
          .lean(),
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
      const locations = [...new Set([...departures, ...arrivals])].sort((a, b) => a.localeCompare(b));

      return response.json({
        success: true,
        message: "Homepage travel information retrieved.",
        data: {
          routes: routes.map(publicRouteResponse),
          destinations: destinations.map(({ _id, startingFare, departure, transport, routeCount }) => ({
            name: _id,
            departure,
            transport,
            startingFare,
            routeCount,
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
