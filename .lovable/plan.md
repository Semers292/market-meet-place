# Buyer-Seller Marketplace — Build Plan

A marketplace where **sellers** post items and **buyers** browse, filter, and contact sellers (in-app message, Telegram, Instagram, phone). Admin oversees everything.

## Languages

UI in **English, Amharic (አማርኛ), Afaan Oromoo, Somali**, with a language switcher in the header. Strings stored as translation dictionaries; default = English.

## Design direction

Dark premium + neon accents. Colors: `#0a0a0f` background, `#1a1b2e` surfaces, `#7c3aed` primary (violet), `#22d3ee` accent (cyan). Font: **Space Grotesk** (display) + **Inter** (body). Subtle 3D / parallax hero on the home page (animated gradient blobs, tilted floating product cards, scroll-reveal). Smooth motion, no overdone effects.

## Auth flow (TextBee SMS)

Free SMS via **textbee.dev**. The API key + device ID will be stored as server-side secrets (`TEXTBEE_API_KEY`, `TEXTBEE_DEVICE_ID`) — never exposed to the browser.

**Buyer signup:** phone → request SMS code → enter code → set password + confirm.
**Buyer signin:** phone + password.

**Seller signup:** phone → SMS code → password + confirm → upload National ID **front + back** → status = `pending`. Cannot post until admin approves.
**Seller signin:** phone + password. If `pending` → "Awaiting approval" screen. If `rejected` → reason shown.

Passwords hashed (bcrypt) server-side. Session cookies (httpOnly, encrypted via TanStack Start sessions).

## Roles

`buyer`, `seller`, `admin`. Stored in a separate `user_roles` table (never on profile — privilege-escalation safe). First admin seeded via migration; admin promotes others.

## Data model (Lovable Cloud / Postgres)

- `profiles` — id (auth user), phone, role, full_name, created_at
- `seller_verifications` — seller_id, id_front_url, id_back_url, status (pending/approved/rejected), reviewed_by, reviewed_at, rejection_reason
- `categories` — id, slug, name_en/am/or/so, icon, supports_condition (bool — true for tech, false for houses)
- `listings` — id, seller_id, category_id, title, description, price, currency, condition (new/used, nullable), location, status (active/sold/removed), created_at
- `listing_attributes` — listing_id, key, value (free-form specs like "model: S22 Ultra", "rooms: 3")
- `listing_images` — listing_id, url, sort_order
- `contact_options` — listing_id, type (phone/telegram/instagram/whatsapp/in_app), value
- `messages` — buyer_id, seller_id, listing_id, body, created_at, read_at
- `sms_codes` — phone, code_hash, purpose, expires_at, consumed
- `admin_logs` — admin_id, action, target, created_at

RLS: buyers read only `active` listings + approved sellers; sellers read/write own; admin reads all via `has_role(auth.uid(), 'admin')` security-definer function. Public-schema GRANTs included.

## Pages

**Public**
- `/` — Home: 3D hero, featured categories, trending listings, how-it-works, language switcher
- `/auth` — tabs: Buyer / Seller × Sign in / Sign up (with SMS step)
- `/browse` — listing grid + filters
- `/browse/$category` — per-category listing grid
- `/listings/$id` — listing detail with image gallery + contact panel (Telegram/Instagram/Phone/in-app)

**Buyer (`_authenticated`)**
- `/buyer/dashboard` — saved listings, messages
- `/buyer/messages` — chat threads

**Seller (`_authenticated`, role=seller, approved)**
- `/seller/dashboard` — stats, my listings
- `/seller/listings/new` — create listing (category-aware fields; "condition" only shows for tech)
- `/seller/listings/$id/edit`
- `/seller/messages`
- `/seller/pending` — shown while awaiting approval

**Admin (`_authenticated`, role=admin)**
- `/admin` — overview metrics
- `/admin/sellers` — pending ID verifications (view front/back, approve/reject)
- `/admin/users` — all users, can suspend / message
- `/admin/listings` — moderate listings
- `/admin/messages` — contact buyers/sellers directly

## Smart filters

Category-aware. Tech category exposes brand/model/storage/condition. House category exposes rooms/area/location and hides condition. Price-range slider, location, sort (newest/cheapest). Filter state in URL search params.

## Contact + notifications

When a buyer contacts a seller, the seller gets:
1. In-app message (live via Cloud realtime)
2. SMS via TextBee server function: `POST https://api.textbee.dev/api/v1/gateway/devices/{deviceId}/send-sms` with `{ recipients: [sellerPhone], message: "New inquiry on your listing X" }`

Same TextBee endpoint powers signup OTPs and admin → user messages. All TextBee calls happen in `createServerFn` handlers; the API key never reaches the browser.

## Admin oversight

Admin can read every table, see all messages, message any user, approve/reject sellers, and remove listings. All admin actions logged to `admin_logs`.

## Technical notes

- TanStack Start file routes; `_authenticated/` layout owns the auth gate; `_authenticated/_admin/` and `_authenticated/_seller-approved/` nested layouts gate role + status.
- TanStack Query for data; `createServerFn` for all DB + TextBee calls.
- Image uploads → Lovable Cloud Storage buckets: `listing-images` (public), `seller-ids` (private; admin-only signed URLs).
- i18n via lightweight context + dictionaries in `src/i18n/{en,am,or,so}.ts`. No external i18n library needed.
- Zod validation on every server function input.
- Phone format normalized to E.164.

## Build order

1. Enable Lovable Cloud + design system + i18n scaffolding
2. DB migrations (tables, roles, RLS, storage buckets)
3. TextBee server function + SMS code flow
4. Auth pages (buyer + seller flows, ID upload)
5. Home page with 3D hero
6. Browse + listing detail + filters
7. Seller dashboard + create/edit listing
8. Buyer dashboard + messaging
9. Admin panel (verifications, users, listings, messages)
10. Polish, empty states, error boundaries, SEO

This is a large build. I'll ship it in iterations — first auth + home + browse, then seller posting + admin verification, then messaging + admin messaging. You'll see progress at each step and can redirect anytime.
