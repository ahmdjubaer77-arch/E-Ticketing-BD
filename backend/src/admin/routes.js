import { Router } from "express";
import { createAuthMiddleware } from "../auth/middleware.js";
import { createAdminOperatorsRouter } from "./operators.js";
import { createAdminOffersRouter } from "./offers.js";
import { createAdminOverviewRouter } from "./overview.js";
import { createAdminBookingsRouter } from "./bookings.js";
import { createAdminRoutesManagementRouter } from "./routes-management.js";
import { createAdminSchedulesRouter } from "./schedules.js";
import { createAdminUsersRouter } from "./users.js";
import { createAdminVehiclesRouter } from "./vehicles.js";
import { createAdminPaymentMethodsRouter } from "./payment-methods.js";

export function createAdminRouter(config) {
  const router = Router();
  const { requireAuth, requireRole } = createAuthMiddleware(config);

  router.use(requireAuth, requireRole("admin"));

  router.get("/me", (request, response) => {
    const { id, fullName, email, phone, role, isEmailVerified, emailVerifiedAt } = request.user;
    response.json({
      success: true,
      message: "Administrator session.",
      data: {
        user: { id, fullName, email, phone, role, isEmailVerified, emailVerifiedAt },
      },
    });
  });

  router.use("/overview", createAdminOverviewRouter());
  router.use("/bookings", createAdminBookingsRouter());
  router.use("/payment-methods", createAdminPaymentMethodsRouter());
  router.use("/users", createAdminUsersRouter());
  router.use("/operators", createAdminOperatorsRouter(config));
  router.use("/offers", createAdminOffersRouter(config));
  router.use("/routes", createAdminRoutesManagementRouter());
  router.use("/schedules", createAdminSchedulesRouter());
  router.use("/vehicles", createAdminVehiclesRouter(config));

  return router;
}
