import Booking from "../models/Booking.js";
import Schedule from "../models/Schedule.js";

export async function expirePendingBookings(now = new Date()) {
  const dueBookings = await Booking.find({
    status: "pending",
    paymentStatus: "pending",
    expiresAt: { $ne: null, $lte: now },
  }).select("_id scheduleId seatNumbers").lean();

  let expiredCount = 0;
  for (const dueBooking of dueBookings) {
    const expiredBooking = await Booking.findOneAndUpdate(
      {
        _id: dueBooking._id,
        status: "pending",
        paymentStatus: "pending",
        expiresAt: { $ne: null, $lte: now },
      },
      { $set: { status: "expired" } },
      { new: true },
    ).select("_id scheduleId seatNumbers").lean();
    if (!expiredBooking) continue;

    await Schedule.updateOne(
      { _id: expiredBooking.scheduleId, deletedAt: null },
      { $inc: { availableSeats: expiredBooking.seatNumbers.length } },
    );
    expiredCount += 1;
  }
  return expiredCount;
}
