import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { AUTH_COOKIE_NAME } from "./cookies.js";

export function createAuthMiddleware(config) {
  async function optionalAuth(request, response, next) {
    const token = request.cookies?.[AUTH_COOKIE_NAME];
    if (!token) return next();
    try {
      const payload = jwt.verify(token, config.jwtSecret, { algorithms: ["HS256"] });
      const user = await User.findById(payload.sub).select("fullName email phone role isActive isEmailVerified tokenVersion");
      if (!user || !user.isActive || !user.isEmailVerified || user.tokenVersion !== payload.tokenVersion) {
        return response.status(401).json({ success: false, message: "Authentication required." });
      }
      request.user = user;
      return next();
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
        return response.status(401).json({ success: false, message: "Authentication required." });
      }
      return next(error);
    }
  }

  async function requireAuth(request, response, next) {
    const token = request.cookies?.[AUTH_COOKIE_NAME];
    if (!token) {
      return response.status(401).json({ success: false, message: "Authentication required." });
    }

    try {
      const payload = jwt.verify(token, config.jwtSecret, { algorithms: ["HS256"] });
      const user = await User.findById(payload.sub).select("fullName email phone role isActive isEmailVerified tokenVersion");
      if (!user || !user.isActive || !user.isEmailVerified || user.tokenVersion !== payload.tokenVersion) {
        return response.status(401).json({ success: false, message: "Authentication required." });
      }
      request.user = user;
      return next();
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
        return response.status(401).json({ success: false, message: "Authentication required." });
      }
      return next(error);
    }
  }

  function requireRole(...roles) {
    return (request, response, next) => {
      if (!request.user || !roles.includes(request.user.role)) {
        return response.status(403).json({ success: false, message: "You are not authorized to access this resource." });
      }
      return next();
    };
  }

  return { requireAuth, optionalAuth, requireRole };
}
