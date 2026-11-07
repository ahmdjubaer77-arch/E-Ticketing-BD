# E-Ticketing Authentication API

## Requirements

- Node.js 20 or newer
- MongoDB (local or hosted)
- An SMTP account for verification and password-reset mail

Copy `.env.example` to `.env` inside `backend` and set the values:

```env
PORT=3001
MONGODB_URI=mongodb://127.0.0.1:27017/e-ticketing
JWT_SECRET=<at-least-32-random-characters>
JWT_EXPIRES_IN=1h
JWT_REMEMBER_ME_EXPIRES_IN=7d
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=<smtp-account>
SMTP_PASS=<smtp-password-or-app-password>
SMTP_FROM_EMAIL=<verified-sender-address>
SMTP_FROM_NAME=E-Ticketing
CLIENT_URL=http://localhost:5173
ADMIN_CLIENT_URL=http://localhost:5174
CLOUDINARY_CLOUD_NAME=<cloud-name>
CLOUDINARY_API_KEY=<api-key>
CLOUDINARY_API_SECRET=<api-secret>
NODE_ENV=development
```

Keep `.env` private; only the placeholder `.env.example` belongs in source control. Configure all three Cloudinary values locally to enable image uploads; they are optional at startup, but upload requests return an explicit service-unavailable error until configured. Never expose the API secret to either browser app. For production, use HTTPS for both client origins, a strong unique `JWT_SECRET`, and `SMTP_SECURE=true` when the SMTP provider requires implicit TLS (commonly port 465).

Run the API from `backend`:

```powershell
npm install
npm run dev
```

Run the customer frontend with `npm run dev` from `frontend` and the admin panel with `npm run dev` from `admin-panel`. Both Vite development servers proxy `/api` requests to `http://localhost:3001` by default; set `API_PROXY_TARGET` if the backend runs elsewhere. Development API CORS accepts HTTP loopback origins on any port, so Vite can choose another port if its default is busy. The admin panel requires an active administrator login.

For production, route `/api/*` from each static frontend to the backend (the Vercel projects use the included `vercel.json` rewrite; for a Render Static Site, add an `/api/*` rewrite to `https://<backend-service>.onrender.com/api/*`). Set the backend `CLIENT_URL` and `ADMIN_CLIENT_URL` environment variables to the exact HTTPS origins of the customer and admin sites, respectively, then redeploy the backend. Production CORS allows only those configured origins; it does not allow arbitrary Render or localhost origins.

To securely provision the first administrator after MongoDB is reachable, run `npm run admin:create -- admin@example.com` from `backend`. The command refuses to modify any existing account, creates a verified admin with a random one-time password, and prints that password once after successful creation. To promote an existing active, verified account without changing its password, run `npm run admin:promote -- account@example.com`. If that account needs a new password as well, run `npm run admin:setup -- account@example.com`; it changes the role, replaces the password with a random temporary one, revokes existing sessions, and prints the password only after the database update succeeds. Use these commands only for accounts you control.

### Gmail SMTP

1. Enable 2-Step Verification on the Google account.
2. Open Google Account security settings and create an App Password (Google may require a qualifying account).
3. Use the generated App Password as `SMTP_PASS`; do not use the normal account password.
4. Set `SMTP_USER` and `SMTP_FROM_EMAIL` to the Gmail account address.

## Authentication endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/auth/register` | Validate and create a pending account; send email verification OTP |
| POST | `/api/auth/verify-email` | Verify a 6-digit email OTP and sign in |
| POST | `/api/auth/resend-otp` | Resend an email verification OTP (60-second cooldown) |
| POST | `/api/auth/login` | Sign in a verified user |
| POST | `/api/auth/forgot-password` | Request a reset OTP (generic response prevents account enumeration) |
| POST | `/api/auth/verify-reset-otp` | Verify reset OTP and issue a one-time reset token |
| POST | `/api/auth/reset-password` | Replace password and revoke existing JWT sessions |
| POST | `/api/auth/logout` | Revoke current JWT sessions and clear the auth cookie |
| GET | `/api/auth/me` | Return the authenticated user |
| GET | `/api/auth/admin` | Example role-protected administrator endpoint |
| GET | `/api/public/home` | Return active route cards, destination starting fares, and route locations for the customer homepage |
| GET | `/api/public/schedules/:id/seats` | Return live booked/held seats for a bus schedule |
| GET | `/api/public/payment-methods` | Return currently active payment methods and account instructions |
| POST | `/api/public/bookings/hold` | Hold a seat immediately for three minutes; send the booking bearer token to add more seats to the same hold |
| DELETE | `/api/public/bookings/:id/seats/:seatNumber` | Release one seat from the customer's active hold using its bearer token |
| POST | `/api/public/bookings` | Reserve 1–10 available bus seats for a customer for three minutes; payment starts pending |
| GET | `/api/public/bookings/:id` | Read a reservation's live status using its returned bearer access token |
| POST | `/api/public/bookings/:id/proof` | Submit a transaction ID and optional JPEG/PNG/WebP screenshot with the reservation bearer token |
| GET | `/api/admin/me` | Return the signed-in administrator profile; requires an active, verified admin account |
| GET | `/api/admin/overview` | Return live database totals, date-range trends, schedule breakdowns, and recent schedules |
| GET | `/api/admin/users` | Search, filter, sort, paginate users, and return account statistics |
| GET | `/api/admin/users/:id` | Return a user's profile; bookings are not linked to user accounts |
| POST | `/api/admin/users` | Create a verified regular user with a bcrypt-hashed password |
| PUT | `/api/admin/users/:id` | Update a user's name, email, phone, or password |
| PATCH | `/api/admin/users/:id/status` | Block or unblock a regular user; blocking revokes existing sessions |
| DELETE | `/api/admin/users/:id` | Soft-deactivate a regular user and revoke sessions; records are retained |
| GET | `/api/admin/operators` | Search, filter, sort, paginate operators, and return status statistics |
| GET | `/api/admin/operators/:id` | Return operator profile and explicitly indicate unavailable related entity data |
| POST | `/api/admin/operators` | Create an operator; logo must be an HTTPS URL |
| PUT | `/api/admin/operators/:id` | Update operator profile fields |
| POST/DELETE | `/api/admin/operators/:id/logo` | Upload or remove the operator logo in Cloudinary and persist its URL |
| PATCH | `/api/admin/operators/:id/status` | Activate or deactivate an operator |
| DELETE | `/api/admin/operators/:id` | Soft-archive an operator and retain its record |
| GET | `/api/admin/vehicles` | Search, filter, sort, paginate vehicles, populate operators, and return status statistics |
| GET | `/api/admin/vehicles/:id` | Return vehicle details and operator information |
| POST | `/api/admin/vehicles` | Create a vehicle linked to an active, matching-transport operator |
| PUT | `/api/admin/vehicles/:id` | Update vehicle fields and validate its operator relationship |
| POST/DELETE | `/api/admin/vehicles/:id/image` | Upload or remove the vehicle image in Cloudinary and persist its URL |
| PATCH | `/api/admin/vehicles/:id/status` | Set vehicle status to active, inactive, or maintenance |
| DELETE | `/api/admin/vehicles/:id` | Soft-deactivate and archive a vehicle; retain its record |
| GET | `/api/admin/routes` | Search, filter, sort, paginate routes, and return status statistics |
| GET | `/api/admin/routes/:id` | Return route details and explicitly indicate unavailable schedules |
| POST | `/api/admin/routes` | Create a route with duplicate route validation |
| PUT | `/api/admin/routes/:id` | Update route details |
| PATCH | `/api/admin/routes/:id/status` | Activate or deactivate a route |
| DELETE | `/api/admin/routes/:id` | Soft-deactivate and archive a route; retain its record |
| GET | `/api/admin/schedules` | Search, filter by date/transport/status, sort, paginate, and return schedule statistics |
| GET | `/api/admin/schedules/:id` | Return schedule with populated operator, vehicle, and route details |
| POST | `/api/admin/schedules` | Create schedule with reference, seat-capacity, chronology, and vehicle-overlap validation |
| PUT | `/api/admin/schedules/:id` | Update schedule after the same validation checks |
| PATCH | `/api/admin/schedules/:id/status` | Set schedule status to scheduled, active, completed, or cancelled |
| DELETE | `/api/admin/schedules/:id` | Cancel and archive schedule; retain the record |
| GET | `/api/admin/bookings` | List database-backed admin bookings |
| GET | `/api/admin/bookings/schedules/:id/seats` | Read upcoming schedule details and currently reserved seats |
| POST | `/api/admin/bookings` | Reserve 1–10 available seats for a customer; payment remains pending |
| PATCH | `/api/admin/bookings/:id/confirm` | Confirm a pending booking |
| PATCH | `/api/admin/bookings/:id/cancel` | Cancel a booking and release its seats |
| PATCH | `/api/admin/bookings/:id/payment-status` | Manually set Pending, Paid, Failed, or Refunded |
| GET/POST | `/api/admin/payment-methods` | List payment methods or add a method with account number and instructions |
| PATCH | `/api/admin/payment-methods/:id` | Edit or activate/deactivate a payment method |
| GET | `/api/admin/bookings/:id/payment-proof-image` | View a customer's private payment screenshot; requires administrator authentication |
| GET | `/api/admin/bookings/tickets` | List one database-backed passenger ticket per reserved seat |
| PATCH | `/api/admin/bookings/:id/tickets/:ticketCode/verify` | Verify an upcoming ticket once and mark it used |
| GET | `/api/health` | API health check |

Admin APIs reuse the existing HttpOnly JWT cookie, session-version checks, and `requireRole("admin")` middleware. Public registration always creates a regular user; this API intentionally provides no public role-escalation or administrator-provisioning endpoint. Provision administrator accounts through a trusted, access-controlled operational process.

Admin user list query parameters: `search`, `status=active|blocked`, `from=YYYY-MM-DD`, `to=YYYY-MM-DD`, `sort=newest|oldest`, `page`, and `limit` (maximum 100). Administrator accounts cannot be blocked, unblocked, or deleted through the user-management API. Delete is soft deactivation because the existing schema has no deletion marker. Admin-created reservations retain customer contact and journey snapshots but are not attached to a customer account, so user detail booking history remains unavailable.

Admin operator list query parameters: `search`, `transport=Bus|Train|Launch|Event`, `status=active|inactive|pending`, `sort=newest|oldest|name_asc|name_desc`, `page`, and `limit` (maximum 100). Operator details return `relationships.available: false`; no relationship counts are fabricated. The authenticated logo endpoint accepts raw JPEG/PNG/WebP bytes up to 2 MB, stores the image under an operator-specific Cloudinary public ID, and stores the HTTPS URL and private public ID on the existing operator document. `DELETE` archives the operator rather than removing its record.

Admin vehicle list query parameters: `search`, `transport=Bus|Train|Launch`, `operatorId`, `status=active|inactive|maintenance`, `sort=newest|oldest|name_asc|name_desc`, `page`, and `limit` (maximum 100). The authenticated image endpoint accepts raw JPEG/PNG/WebP bytes up to 2 MB, stores the image under a vehicle-specific Cloudinary public ID, and stores its HTTPS URL and private public ID on the existing vehicle document. Delete is implemented as soft deactivation/archive so future references are not orphaned.

Admin route list query parameters: `search`, `transport=Bus|Train|Launch|Event`, `status=active|inactive`, `sort=newest|oldest|departure_asc|departure_desc|fare_asc|fare_desc`, `page`, and `limit` (maximum 100). The route API does not currently return related schedules, so popularity and route-linked schedule data are reported as unavailable instead of inferred. Route delete archives the route, and duplicate active routes are prevented by a normalized, transport-scoped unique index.

The admin overview accepts `days=7|30|90` (default `30`) and reports totals for regular users, operators, vehicles, routes, schedules, and bookings. Its activity chart counts newly created users, operators, schedules, and bookings; schedule status and transport breakdowns use departure dates within the selected period. Revenue analytics remain unavailable because payments are not processed by this backend.

Admin schedule list query parameters: `search`, `date=YYYY-MM-DD`, `from`, `to`, `transport=Bus|Train|Launch`, `operatorId`, `status=scheduled|active|completed|cancelled`, `sort=departure_asc|departure_desc|newest|oldest`, `page`, and `limit` (maximum 100). Total seats must match the referenced vehicle capacity. Schedules with active reservations cannot be edited, cancelled, or archived until those bookings are cancelled and seats are released. Schedule deletion archives the record rather than removing it.

## User account dashboard API

| Method | Endpoint | Purpose |
|---|---|---|
| GET/PATCH | `/api/users/me` | Read or update the authenticated user's own name and phone |
| POST/DELETE | `/api/users/me/avatar` | Upload (JPEG/PNG/WebP, at most 400 KB) or remove the user's profile image |
| PATCH | `/api/users/change-password` | Verify current password, change it and rotate the session version |
| POST | `/api/users/change-email` | Start a new-email OTP verification (requires current password) |
| POST | `/api/users/resend-email-verification` | Resend the pending email-change OTP |
| POST | `/api/users/verify-new-email` | Verify and activate the new email address |
| POST | `/api/users/deactivate` | Deactivate the account with password and explicit confirmation; retain records |
| DELETE | `/api/users/me` | Permanently delete the user and owned notifications (password, confirmation, MongoDB transaction required) |
| GET | `/api/notifications` | List this user's notifications with pagination and unread count |
| PATCH | `/api/notifications/:id/read` | Mark an owned notification as read |
| PATCH | `/api/notifications/read-all` | Mark all of this user's notifications as read |
| DELETE | `/api/notifications/:id` | Delete an owned notification |

Profile and notification operations are scoped to the authenticated user ID, not a caller-supplied owner ID. Profile pictures are stored in Cloudinary at a stable user-specific public ID; only the secure URL and a non-public Cloudinary public ID are stored on that user's existing User document. Login/session restore reads the saved profile URL from `/api/users/me`. Existing legacy data-URI profile pictures remain readable until changed or removed. Permanent deletion requires MongoDB transaction support (replica set/Atlas); if transactions are unavailable, deletion fails without partially removing data. Booking records are not deleted with a customer account because admin-created reservations are stored independently from user accounts.

Admin bookings and customer seat reservations are persisted in MongoDB. Tapping an available seat immediately creates a three-minute hold; other customers see that seat as unavailable. Additional seats join the same hold, and deselected seats are released. If the customer submits a valid payment transaction ID within the three-minute window, the hold becomes a persistent booking while the administrator reviews the proof. If no proof is submitted by the deadline, a background expiry task releases the seats. Admins configure payment methods, account numbers, instructions, and whether each method is active in the Payments workspace; only active methods appear at customer checkout. Customers pay outside the site, submit the payment transaction ID, and may attach a JPEG/PNG/WebP screenshot up to 1 MB. The screenshot is stored in MongoDB and is served only by the authenticated admin proof-image endpoint. Submitting proof does not itself verify payment: the administrator reviews it and marks the booking Paid to approve it, or Failed to reject it and release its seats. The website does not collect money or connect to a payment gateway. An admin can also manually set Pending (starts a fresh three-minute hold) or Refunded (cancels the booking and releases seats). The customer confirmation page polls the reservation status using a random bearer token. Each reserved seat has a unique ticket code; upcoming paid tickets can be verified once and marked used. The admin ticket preview can be printed or saved as PDF through the browser print dialog; QR scanning and actual refunds are not connected.

JSON success responses use `{ "success": true, "message": "...", "data": {} }` where data applies. Errors use `{ "success": false, "message": "...", "errors": {} }` where field errors apply. Authentication is a JWT in an HttpOnly, SameSite=Strict cookie; login sessions use `JWT_EXPIRES_IN`, while the sign-in form's optional “Remember me” uses `JWT_REMEMBER_ME_EXPIRES_IN`. Browser requests include credentials. No password, OTP, SMTP secret, or JWT is returned by the API.

## User document

`User` stores normalized unique email, full name, optional phone, bcrypt password hash, role, active and email-verification state, verification timestamps, HMAC OTP/reset hashes with expiry/cooldown timestamps, one-time reset-token hash/expiry, a JWT `tokenVersion`, and Mongoose timestamps. Password and secret hashes are excluded from normal query projections.

## Tests and operational limitations

Run `npm test` from `backend` for automated authentication-helper and admin-authorization tests. A full workflow test requires a running MongoDB and an SMTP test account; no credentials or external service are included in this project. The frontend shows service failures rather than simulating registration, verification, or login success.
