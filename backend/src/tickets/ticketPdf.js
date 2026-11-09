import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { jsPDF } from "jspdf";
import QRCode from "qrcode";

const logoPath = fileURLToPath(new URL("./ticket-bus-logo.jpeg", import.meta.url));
const logoData = `data:image/jpeg;base64,${readFileSync(logoPath).toString("base64")}`;
const palette = {
  green: [0, 119, 71],
  deep: [0, 75, 52],
  ink: [20, 30, 27],
  muted: [86, 105, 96],
  pale: [239, 249, 243],
  mint: [220, 245, 231],
  line: [185, 218, 200],
  gold: [180, 135, 55],
  white: [255, 255, 255],
};

function drawLabel(doc, value, x, y) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.1);
  doc.setTextColor(...palette.muted);
  doc.text(value.toUpperCase(), x, y);
}

function drawValue(doc, value, x, y, size = 10, width = 70, color = palette.ink) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(size);
  doc.setTextColor(...color);
  doc.text(doc.splitTextToSize(String(value || "-"), width)[0], x, y);
}

function drawPin(doc, x, y) {
  doc.setFillColor(...palette.green);
  doc.circle(x, y, 4.5, "F");
  doc.triangle(x - 3.4, y + 2, x + 3.4, y + 2, x, y + 10, "F");
  doc.setFillColor(...palette.white);
  doc.circle(x, y - 0.3, 1.5, "F");
}

function drawCalendar(doc, x, y) {
  doc.setDrawColor(...palette.green);
  doc.setLineWidth(0.9);
  doc.roundedRect(x, y, 7, 7, 0.8, 0.8, "S");
  doc.line(x, y + 2, x + 7, y + 2);
  doc.line(x + 1.7, y - 1, x + 1.7, y + 1);
  doc.line(x + 5.3, y - 1, x + 5.3, y + 1);
  doc.setFillColor(...palette.green);
  doc.circle(x + 2.1, y + 4.2, 0.45, "F");
  doc.circle(x + 4.9, y + 4.2, 0.45, "F");
}

function drawClock(doc, x, y) {
  doc.setDrawColor(...palette.green);
  doc.setLineWidth(1);
  doc.circle(x + 4, y + 4, 4, "S");
  doc.line(x + 4, y + 4, x + 4, y + 1.5);
  doc.line(x + 4, y + 4, x + 6.3, y + 5.2);
}

function drawSeat(doc, x, y) {
  doc.setDrawColor(...palette.green);
  doc.setLineWidth(1.2);
  doc.roundedRect(x, y, 5, 6, 1, 1, "S");
  doc.line(x + 5, y + 4, x + 7, y + 4);
  doc.line(x + 7, y + 4, x + 7, y + 7);
  doc.line(x + 1, y + 6, x + 1, y + 9);
  doc.line(x + 6, y + 6, x + 6, y + 9);
  doc.line(x, y + 9, x + 7, y + 9);
}

function drawPerson(doc, x, y) {
  doc.setDrawColor(...palette.green);
  doc.setLineWidth(0.9);
  doc.circle(x + 4, y + 2.5, 2.3, "S");
  doc.line(x, y + 12, x, y + 10.5);
  doc.line(x, y + 10.5, x + 1.7, y + 7.5);
  doc.line(x + 1.7, y + 7.5, x + 6.3, y + 7.5);
  doc.line(x + 6.3, y + 7.5, x + 8, y + 10.5);
  doc.line(x + 8, y + 10.5, x + 8, y + 12);
  doc.line(x, y + 12, x + 8, y + 12);
}

function drawTicket(doc, booking, ticket, qrData) {
  const width = 280;
  const height = 122;
  const journeyDate = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Dhaka",
  }).format(new Date(booking.departureAt));
  const departureTime = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Dhaka",
  }).format(new Date(booking.departureAt));

  doc.setFillColor(249, 252, 250);
  doc.rect(0, 0, width, height, "F");
  doc.setDrawColor(225, 236, 229);
  doc.setLineWidth(0.55);
  doc.roundedRect(5.8, 6, 270, 112, 5, 5, "S");
  doc.setFillColor(...palette.white);
  doc.setDrawColor(...palette.deep);
  doc.setLineWidth(0.65);
  doc.roundedRect(5, 5, 270, 112, 5, 5, "FD");

  // Decorative corner ribbons are kept clear of passenger details.
  doc.setFillColor(0, 129, 78);
  doc.triangle(5, 112, 5, 117, 21, 117, "F");
  doc.setFillColor(108, 211, 163);
  doc.triangle(5, 114, 5, 117, 14, 117, "F");
  doc.setFillColor(0, 129, 78);
  doc.triangle(222, 5, 275, 5, 275, 23, "F");
  doc.setFillColor(108, 211, 163);
  doc.triangle(241, 5, 275, 5, 275, 17, "F");

  doc.setFillColor(...palette.white);
  doc.roundedRect(13, 9, 37, 25, 3, 3, "F");
  doc.addImage(logoData, "JPEG", 15, 10.5, 33, 21.5);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(...palette.ink);
  doc.text("BD E-Ticketing", 54, 20);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...palette.deep);
  doc.text("Bus Ticketing System", 54, 27);
  doc.setDrawColor(...palette.gold);
  doc.setLineWidth(0.55);
  doc.line(54, 30.5, 113, 30.5);

  doc.setFillColor(...palette.green);
  doc.roundedRect(166, 12, 40, 12, 6, 6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...palette.white);
  doc.text("E-Ticket", 186, 19.8, { align: "center" });
  doc.setFillColor(...palette.mint);
  doc.roundedRect(166, 27, 40, 8, 4, 4, "F");
  doc.setFontSize(6.4);
  doc.setTextColor(...palette.deep);
  doc.text("OFFICIAL JOURNEY PASS", 186, 32.3, { align: "center" });

  doc.setFillColor(...palette.pale);
  doc.setDrawColor(225, 239, 230);
  doc.setLineWidth(0.35);
  doc.roundedRect(12, 39, 194, 27, 4, 4, "FD");
  drawPin(doc, 25, 49);
  drawPin(doc, 149, 49);
  drawLabel(doc, "Departure", 35, 45);
  drawLabel(doc, "Destination", 159, 45);
  drawValue(doc, booking.departure, 35, 54, 16, 58);
  drawValue(doc, booking.destination, 159, 54, 16, 43);
  doc.setDrawColor(...palette.gold);
  doc.setLineWidth(0.9);
  doc.setLineDashPattern([2.4, 2.1], 0);
  doc.line(99, 52, 133, 52);
  doc.setLineDashPattern([], 0);
  doc.setFillColor(...palette.deep);
  doc.triangle(133, 50.2, 136.3, 52, 133, 53.8, "F");
  drawCalendar(doc, 22, 76);
  drawClock(doc, 99, 76);
  drawLabel(doc, "Journey Date", 33, 78);
  drawLabel(doc, "Departure Time", 111, 78);
  drawLabel(doc, "Seat No.", 166, 78);
  drawValue(doc, journeyDate, 33, 86, 10.2, 49);
  drawValue(doc, departureTime, 111, 86, 10.2, 47);
  drawSeat(doc, 165, 81);
  doc.setFillColor(...palette.mint);
  doc.roundedRect(176, 80, 29, 10, 4, 4, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...palette.deep);
  doc.text(String(ticket.seatNumber || "-"), 190.5, 87.2, { align: "center" });

  doc.setDrawColor(...palette.line);
  doc.setLineWidth(0.35);
  doc.line(18, 91, 204, 91);
  drawPerson(doc, 21, 97);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...palette.deep);
  doc.text("Passenger Details", 36, 100);
  drawLabel(doc, "Name", 36, 106);
  drawValue(doc, ticket.passengerName || booking.customerName, 60, 106, 9.4, 55);
  drawLabel(doc, "Phone", 36, 111);
  drawValue(doc, booking.customerPhone || "Not provided", 60, 111, 7.3, 57);

  doc.setDrawColor(...palette.line);
  doc.line(126, 96, 126, 112);
  drawLabel(doc, "Unique Ticket ID", 137, 100);
  doc.setFillColor(...palette.mint);
  doc.roundedRect(135, 102, 70, 10, 3, 3, "F");
  drawValue(doc, ticket.ticketCode, 139, 108.7, 8.7, 62, palette.deep);

  // Perforated verification stub with a QR that contains only a verification URL.
  doc.setDrawColor(...palette.line);
  doc.setLineWidth(0.8);
  for (let y = 8; y < 113; y += 4) doc.line(217, y, 217, Math.min(y + 2, 113));
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.8);
  doc.setTextColor(...palette.deep);
  doc.text("SCAN FOR VERIFICATION", 246, 23, { align: "center" });
  doc.setDrawColor(...palette.line);
  doc.setFillColor(...palette.white);
  doc.roundedRect(223, 27, 46, 46, 2.5, 2.5, "FD");
  doc.addImage(qrData, "PNG", 225, 29, 42, 42);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.2);
  doc.setTextColor(...palette.ink);
  doc.text("Ticket ID", 246, 81, { align: "center" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.8);
  doc.setTextColor(...palette.deep);
  doc.text(doc.splitTextToSize(ticket.ticketCode, 48).slice(0, 2), 246, 87, { align: "center" });
}

export async function createTicketPdf({ booking, ticket, verificationUrl }) {
  const qrData = await QRCode.toDataURL(verificationUrl, {
    errorCorrectionLevel: "H",
    margin: 1,
    width: 320,
  });
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: [280, 122], compress: true });
  doc.setProperties({
    title: `E-Ticket ${ticket.ticketCode}`,
    subject: `Confirmed ${booking.transport || "bus"} ticket`,
    creator: "BD E-Ticketing",
  });
  drawTicket(doc, booking, ticket, qrData);
  return Buffer.from(doc.output("arraybuffer"));
}
