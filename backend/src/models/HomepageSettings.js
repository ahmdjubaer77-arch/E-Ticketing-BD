import mongoose from "mongoose";

const homepageSettingsSchema = new mongoose.Schema(
  {
    _id: { type: String, default: "homepage" },
    featuredRouteIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Route" }],
      default: [],
      validate: {
        validator: (routeIds) => routeIds.length <= 6 && new Set(routeIds.map(String)).size === routeIds.length,
        message: "Choose up to 6 different featured routes.",
      },
    },
  },
  { timestamps: true, strict: "throw" },
);

const HomepageSettings = mongoose.models.HomepageSettings || mongoose.model("HomepageSettings", homepageSettingsSchema);

export default HomepageSettings;
