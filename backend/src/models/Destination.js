import mongoose from "mongoose";

const destinationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
    nameKey: { type: String, required: true, unique: true, select: false },
    image: { type: String, default: "", maxlength: 2048 },
    imagePublicId: { type: String, default: "", maxlength: 200, select: false },
    active: { type: Boolean, default: true, required: true },
  },
  { timestamps: true, strict: "throw" },
);

destinationSchema.pre("validate", function setNameKey() {
  if (this.name) this.nameKey = this.name.trim().replace(/\s+/g, " ").toLocaleLowerCase("en");
});

const Destination = mongoose.models.Destination || mongoose.model("Destination", destinationSchema);

export default Destination;
