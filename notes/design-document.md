# Food Tasting Event App — Design Document

## Overview

This is a full-stack web application designed for a college club's food tasting events. It serves two distinct audiences: **submitters** (student teams who register their dish and ingredient list) and **organizers** (club leadership who manage the event, compile grocery lists, and handle purchasing). The app is built around a Vue 3 + Vite frontend and a Ruby on Rails API backend.

---

## Architecture Summary

```
food-tasting-vue/       ← Vue 3 frontend (this repo)
food-tasting-api/       ← Rails API backend (to be created)
food-tasting-scraper/   ← Scraper script (standalone, run manually)
```

The frontend and backend run as separate services and communicate entirely through a JSON REST API. Real-time features (live updates, notifications) are handled via Action Cable (Rails' WebSocket layer). Both services are independently deployed.

---

## Part 1: The Ingredient Database (Build This First)

### Purpose
A database table representing the full inventory of the Giant grocery store in Easton, PA. This is the foundation everything else depends on — the ingredient search, the price estimates, and the aisle-sorted grocery list all require this data to exist first.

### Data Model: `ingredients`

| Column | Type | Notes |
|---|---|---|
| `id` | integer | Primary key |
| `product_id` | string | Giant's own internal product ID |
| `name` | string | Full product name as listed on Giant's site |
| `image_url` | string | URL to product image hosted by Giant |
| `price_cents` | integer | Price stored in cents to avoid floating point errors. e.g. $3.49 → 349 |
| `size` | string | Human-readable size/quantity string, e.g. "1 lb", "20 oz", "12 ct" |
| `aisle` | string | Aisle label as listed on Giant's site, e.g. "A3", "Produce" |
| `scraped_at` | datetime | When this record was last fetched from Giant |

Storing price in cents is a common, important practice. When you display it, divide by 100 and format as currency.

### The Scraper

#### Why Plain Playwright Won't Work Out of the Box

`giantfoodstores.com` blocks automated access aggressively — the site returns a 403 immediately on any non-browser request. It uses Cloudflare bot protection, which detects headless browsers by examining browser fingerprints and the `navigator.webdriver` flag. Running plain Playwright against it will get you blocked just as fast as a simple HTTP request.

Traditional scrapers (`requests` + BeautifulSoup, `open-uri` + Nokogiri) are not viable either — Giant's product pages are JavaScript-rendered and return empty shells without JS execution.

#### The Aisle Number Constraint

Aisle numbers are the most important and most difficult field to obtain. They exist on Giant's own product detail pages but are not surfaced by third-party services like Instacart. This constrains the approach: any solution that doesn't hit Giant's own site directly will likely not return aisle data. Keep this in mind as you weigh the options below.

#### Option 1: Reverse Engineer the Giant Mobile App API (Recommended First Attempt)

Giant has an iOS/Android app that loads product data from a backend API. That API almost certainly returns structured JSON containing all the fields needed — name, price, size, image, and aisle. Mobile app APIs are typically far less protected than public websites; they don't have Cloudflare in the same way.

**How to do it:**
1. Install [mitmproxy](https://mitmproxy.org/) (free, open source) on your laptop
2. Configure your phone to route traffic through it
3. Open the Giant app and browse a few product categories and individual product pages
4. Watch the intercepted requests — identify the API endpoints being called and the JSON responses
5. Once you have the endpoint patterns and any required headers/tokens, call them directly from a Python or Ruby script

If this yields clean structured data, it is by far the most durable and reliable approach. App APIs change less frequently than website HTML, and you can re-run the script before each event with minimal maintenance.

#### Option 2: Playwright + Stealth + Residential Proxy (DIY, Full Control)

If the app API approach doesn't pan out, Playwright can still work against Giant's website — but it needs two additions:

- **`playwright-extra` + `puppeteer-extra-plugin-stealth`** (Python or Node): patches the fingerprinting tells that Cloudflare detects, making the browser appear to be a real user
- **A residential proxy service**: rotates real residential IP addresses so your requests don't get rate-limited or blocked by IP. Bright Data, Oxylabs, and Smartproxy all offer pay-as-you-go plans starting around $3–5/GB. A single pre-event scrape of Giant's full inventory would likely cost under $2 in proxy bandwidth.

The scraper structure remains the same as any Playwright script:
1. Launch a stealth browser session through the proxy
2. Navigate category by category through Giant's product listings
3. For each product, open the detail page and extract: name, product ID, price, size, image, and aisle
4. Write all collected data to a JSON or CSV file
5. Import that file into the Rails database via a `rake` task (upsert by `product_id`)

This approach gives you Giant's exact data including aisle numbers, but it is the most brittle — Giant can change their HTML at any time, and you'll need to update selectors when they do. Keep selector logic well-documented and isolated so it's easy to patch.

#### Option 3: Apify Instacart Scraper (Easiest Setup, No Aisle Data)

Instacart carries Giant Food Stores (the Easton, PA location is available). Apify offers pre-built, actively maintained [Instacart scrapers](https://apify.com/tropical_quince/instacart-product-scraper) that handle anti-bot and proxy management internally. They return: product name, price, size, image, and Instacart's own category labels.

**What's missing: physical aisle numbers.** Instacart uses its own category taxonomy ("Produce", "Dairy & Eggs", "Frozen Foods") rather than Giant's store aisle labels. This means the organizer grocery list could still be sorted and grouped logically by category — it just wouldn't map to Giant's exact aisle letters/numbers.

Use this option only if you decide aisle-letter precision isn't critical and Instacart's broader categories are sufficient for the shopping workflow. Cost on Apify's free tier is likely enough for a single event's scrape.

#### Scraper Architecture (All Options)

Regardless of which approach is used, the scraper is a **standalone script outside the Rails app**, run manually before each event. The workflow is always:

```
Run scraper → outputs products.json
→ Run: rails db:seed:scraper (or rake import:products)
→ Upserts records into the ingredients table by product_id
```

This keeps the fragile scraping logic completely separate from the application. You fix the scraper independently without touching Rails.

**Re-running before each event:** The `scraped_at` timestamp on each row tracks freshness. The import task upserts by `product_id` — existing products get their price/size/aisle updated, new products get inserted, nothing is duplicated.

### Ingredient Search API

Rails exposes a single search endpoint:

```
GET /api/v1/ingredients?q=chicken
```

This returns a JSON array of matching ingredients. The search should use PostgreSQL's `ILIKE` or a full-text search index for fast, case-insensitive prefix matching on the `name` column. A database index on `name` is required for this to be fast at scale.

---

## Part 2: The Submission UI (Submitter-Facing)

### Purpose
The page submitters (student teams) use to register their team and their dish, and to build their ingredient list.

### Fields

- **Team Name** — plain text input
- **Dish Name** — plain text input
- **Team Members** — a dynamic list where they can add/remove names (simple repeated text inputs)
- **Ingredient Search** — the core interactive feature (see below)
- **Serving Notes** (optional) — a free-text field for anything unusual about their dish, e.g. "gluten-free version available"

### Ingredient Search (Autocomplete)

As the user types in the search box, the frontend sends a request to `GET /api/v1/ingredients?q={query}` after a short debounce delay (around 300ms — long enough to avoid spamming the API on every keystroke, short enough to feel instant). Results appear in a dropdown below the input showing the ingredient's image, name, size, and price.

When a user selects an ingredient from the dropdown, it is added to their ingredient list. Each added ingredient shows:
- Name, size, image thumbnail
- Quantity (how many units of this item they need — defaults to 1, user can adjust)
- Calculated line total (quantity × price)
- A remove button

Users can also add free-text ingredients for items not found in the Giant database (for edge cases), but these will have no price or aisle data associated with them.

### Submission Identity & Access

This is the mechanism by which submitters can return and edit their submission later. No email required. Two options, both simple:

**Option A: Short Code (Default — No Account)**
When a team submits, the app generates a short alphanumeric code (e.g. `TEAM-4F9X`) and displays it on a confirmation screen. The team saves this code — screenshot it, write it down, whatever. To return and edit, they enter the code on a simple lookup page and are taken directly to their submission. No login, no account, nothing to remember except one code.

This is the zero-friction path. Implement this first.

**Option B: Optional Account (If You Want It)**
If you decide to give submitters a more permanent way to access their submission, you can offer a simple account creation step at the end of the submission flow. This is entirely optional — teams that skip it fall back to the short code.

Account creation is three fields: a username (or just their team name slugified), a password, and a confirmed password. That's it. No email, no verification step, no onboarding flow. Rails' `has_secure_password` handles all the password hashing.

When they return, they log in with their username and password and land directly on their submission.

**Forgotten Password (for Option B)**
Since there's no email, the recovery flow is organizer-assisted:

- At account creation, the app generates and displays a **one-time recovery code** (a random string like `RCV-7X2MQP`). The user is told to save this alongside their password. If they forget their password, they enter their username + recovery code and are allowed to set a new one. Recovery codes are single-use and hashed in the database the same way passwords are.
- As a fallback, any organizer can also trigger a password reset from the organizer dashboard. This produces a new temporary password that the team can use to log in and immediately change. Since there are only ~20–30 teams total, this is a perfectly practical escape hatch for the rare case someone loses both their password and recovery code.

The short code (Option A) is still generated regardless of whether an account exists — it serves as a permanent backup identifier tied to that submission.

### Editing a Submission
Once in (via short code or account login), the submitter sees their existing submission pre-filled in the same form. Any saved changes trigger a background notification to the organizer dashboard (see Part 3).

---

## Part 3: The Organizer Dashboard (Organizer-Facing)

### Access Control
Organizers authenticate with a proper username + password login, managed entirely within the Rails app. No third-party auth service is needed at this scale. Rails has `has_secure_password` built in. There are roughly 10 organizer accounts — these can be created manually (no public signup needed).

### Views

#### 3a. Submissions List
A table or card list of every team that has submitted. Shows team name, dish name, member count, and submission timestamp. Clicking a row expands it to show the full ingredient list and any notes. Organizers can see but not edit submissions from this view (edits remain the team's responsibility).

#### 3b. Master Grocery List (The Core Organizer Feature)
This is the most important part of the organizer dashboard.

The app automatically aggregates every ingredient across every submission and groups them by aisle. If Team A needs 2 lbs of chicken breast and Team B also needs 1 lb of chicken breast, the master list shows "Chicken Breast — 3 lbs" under whatever aisle chicken is in, not two separate line items.

The list is structured as:

```
Aisle A
  [ ] Chicken Breast (1 lb pack) × 3      $14.97
  [ ] Jasmine Rice (5 lb bag) × 2         $11.98

Aisle B
  [ ] Olive Oil (16.9 fl oz) × 1          $8.49
  ...

Produce
  [ ] Roma Tomatoes (1 lb) × 4            $7.96

TOTAL ESTIMATED COST: $211.43
```

**Checkboxes:** Each line item has a checkbox. When an organizer checks an item (meaning it has been purchased), that state persists to the database and syncs in real-time to every other organizer viewing the page. This is the shopping-trip workflow — one person at Giant checks things off on their phone, others at home see it update live.

**Aggregation logic:** Lives entirely on the Rails backend. A dedicated endpoint (`GET /api/v1/grocery_list`) computes the aggregated list fresh from the current state of all submissions. The frontend simply renders what Rails returns.

**Free-text ingredients** added by submitters (not found in Giant's database) appear at the bottom of the grocery list under an "Unmatched / Manual Items" section, flagged for organizers to handle manually.

#### 3c. Notifications
A small notification feed visible to organizers showing recent events: "Team Kebab Masters updated their ingredient list (2 min ago)", "Team Mango Tango submitted for the first time". Clicking a notification takes the organizer to that team's submission. These are generated when a submission is created or updated and delivered via WebSocket.

---

## Part 4: Real-Time Sync

### Technology: Action Cable (Rails WebSockets)

Rails ships with Action Cable, which provides WebSocket support out of the box. The Vue frontend connects to the Action Cable server and subscribes to relevant channels. No third-party service is needed.

### Two Channels

**`GroceryListChannel`** — broadcast to all connected organizers. When any organizer checks off a grocery item, the server broadcasts the updated item state to everyone else subscribed to this channel. The frontend patches just that one item in the UI without a full page reload.

**`NotificationsChannel`** — broadcast to all organizers when a submission is created or modified. Delivers a small notification payload that the frontend displays in the notification feed.

### How It Works End-to-End (Example)
1. Organizer B opens the grocery list on her phone at Giant
2. She checks off "Jasmine Rice"
3. Her browser sends a `PATCH /api/v1/grocery_items/:id` request to Rails
4. Rails updates the database, then broadcasts `{ id: 42, checked: true }` to `GroceryListChannel`
5. Organizer A's browser (open on a laptop at home) receives the WebSocket message
6. Vue updates just that list item's checkbox — no page reload, no polling

### Polling Fallback
For submitters checking on their own submission (not organizers), a simple periodic refresh (every 30–60 seconds) is fine. Real-time is only critical for the organizer grocery list.

---

## Part 5: Deployment

### Recommended Stack

| Layer | Service | Why |
|---|---|---|
| Rails API | **Render** (free tier or $7/mo) | Simple deploys from Git, supports Action Cable/WebSockets, includes PostgreSQL |
| Vue Frontend | **Render Static Sites** or **Netlify** (free) | Serves the built Vite output as a static site on a CDN |
| Database | **Render PostgreSQL** or **Supabase** (free tier) | Managed Postgres, no server administration |

This entire stack can run for free or near-free for an event of this scale (~10 organizers, ~20–30 submitter teams).

### Deployment Flow

```
Git push → Render auto-deploys Rails API
Git push → Render/Netlify auto-builds & deploys Vue frontend
```

Both services watch your Git repository and automatically deploy on push to `main`. This means any fix or update you push is live within 2–3 minutes.

### Environment Configuration

The Vue app needs to know the Rails API URL. This is set as a build-time environment variable:

```
# .env.production (in the Vue project)
VITE_API_BASE_URL=https://your-api.onrender.com
```

Rails needs database credentials and email API keys, set as environment variables in the Render dashboard (never committed to Git).

### CORS in Production

The Rails CORS configuration needs to explicitly allow requests from your production Vue domain:

```ruby
origins "https://your-frontend.netlify.app", "http://localhost:5173"
```

### WebSocket in Production (Important)

Render supports WebSockets natively on paid plans ($7/mo). The free tier may close idle WebSocket connections after a period of inactivity. For a small club app, the $7/mo plan is the right call here — the organizer grocery list real-time sync is a core feature.

Action Cable in production requires a Redis instance for the subscription adapter. Render provides a free Redis instance. This is a one-line config change in Rails.

```
# config/cable.yml (production)
production:
  adapter: redis
  url: <%= ENV["REDIS_URL"] %>
```

### Custom Domain (Optional)
Both Render and Netlify support custom domains for free. If the club has a domain, you can point it at the frontend and use a subdomain (e.g. `api.yourdomain.com`) for the Rails backend.

---

## Part 6: AI Recipe Suggestions (Phase 2)

### Feature Description
A button on the submission form labeled something like "Need inspiration?" or "Suggest a recipe". When clicked, it opens a modal or side panel showing:

- A suggested ingredient list for the dish name they entered, pre-scaled for a tasting event (200–300 people, small portions)
- Brief preparation notes
- A "Use these ingredients" action that auto-populates their ingredient search list with the suggestions (matching against the Giant database where possible)

### Implementation

This calls Claude's API (Anthropic) from the Rails backend. The Vue frontend sends:

```
POST /api/v1/recipe_suggestions
{ dish_name: "Jollof Rice", serving_count: 250 }
```

Rails constructs a prompt and calls Claude's API server-side (the API key is never exposed to the frontend). The response is streamed back or returned as JSON.

A good prompt template:
> "Suggest a recipe for {dish_name} scaled to serve {serving_count} people as small tasting portions (approximately 2–3 oz per person). List ingredients with quantities. Focus on ingredients that would be available at a standard American grocery store."

After getting suggestions, the backend attempts to fuzzy-match suggested ingredients against the Giant database and returns both the suggestion text and any matched ingredient records.

### Cost
Claude API calls are inexpensive at this scale. A few dozen recipe suggestions per event would cost well under $1.

---

## Build Order (Recommended Sequence)

1. ✅ **Scraper** — Get Giant's product data into a local database. Nothing else is meaningful without this.
2. ✅ **Rails API skeleton** — Set up the Rails project, database schema (`ingredients` table), and the search endpoint.
3. ✅ **Vue UI shell** — Static component layout matching the UI reference design (no functionality yet). See below.
4. ✅ **Ingredient search in Vue** — Wire up the autocomplete search to confirm the pipeline works end to end. See Step 4.
5. ✅ **Submissions** — Build the submission form and the Rails model/controller for submissions. See Step 5.
6. ✅ **Organizer auth** — Basic login for organizers. See Step 5.
7. ✅ **Organizer dashboard** — Submissions list view and the master grocery list aggregation. See Step 5.
8. ✅ **Real-time sync** — Add Action Cable for grocery list checkbox sync and notifications. See Step 5.
9. **Deployment** — Deploy both apps to Render/Netlify and test the full flow in production.
10. **AI suggestions** — Add Claude integration once everything else is stable.

---

## Implementation Log

### Step 3 — Vue UI Shell (completed)

Converted the React UI reference (`ui-reference/`) into Vue 3 SFCs. Static layout only — no reactive state or API calls yet.

**Files created/modified:**

| File | Change |
|---|---|
| `src/components/AppHeader.vue` | Header with ISA logo and event name (center) + Form/Submissions links (right). |
| `src/components/AppPanel.vue` | Generic panel used for every section. Props: `title`, `variant`, `collapsible`, `expanded`. Emits `toggle`. Default slot for body content. |
| `src/assets/logos/ISA-logo.png` | Copied from `ui-reference/public/` |
| `index.html` | Added Roboto Mono font (Google Fonts), updated page title |
| `src/assets/base.css` | Full-height `html/body/#app`, Roboto Mono as default body font, removed Vue default background/color |
| `src/views/HomeView.vue` | 2-column layout: left (dish name, group members, recipe panels) + right (search, grocery list panels) |
| `package.json` | Added `sass` dev dependency for SCSS in Vue SFCs |

**`AppPanel` variant map:**

| `variant` prop | CSS class(es) applied | Flex behavior |
|---|---|---|
| `'dish-name'` | `panel panel--dish-name` | `flex: 0 0 auto` (fixed height) |
| `'group-members'` | `panel panel--group-members` | `flex: 1` (grows to fill) |
| `'lower'` | `panel panel--lower` | `flex: 1`, collapses to 64px |
| `'search'` | `events` | `flex: 1 1 50%` (search column) |
| `'upper'` | `panel panel--upper` | `flex: 1 1 50%` (list column) |

**To add content to a panel later**, pass content into the slot and wire `@toggle` for collapsible panels:
```vue
<AppPanel title="dish name" variant="dish-name">
  <DishNameForm />
</AppPanel>

<AppPanel title="group members" variant="group-members" collapsible :expanded="isExpanded" @toggle="isExpanded = !isExpanded">
  <GroupMembersPanel />
</AppPanel>
```

---

### Step 4 — Ingredient Search + Submission State (completed)

Wired up the full ingredient search pipeline and built the submission form state on the frontend. Backend CORS was also fixed to allow any localhost port.

**What was built:**

- **Ingredient search** — `IngredientSearch.vue` uses a debounced composable (`useIngredientSearch.ts`) to query `GET /api/v1/ingredients?q=` as the user types. Results appear in an absolute-positioned dropdown (`top-full`) that overlays content below without disrupting layout.
- **Multi-word search fix** — Changed the Rails `search` scope from a single `LIKE` to word-split AND logic, so "philadelphia cream cheese" matches "Philadelphia Original Cream Cheese."
- **Ingredient list** — `IngredientList.vue` reads from the Pinia store and renders each selected item with quantity input, line total, and remove button.
- **Pinia store** (`src/stores/submission.ts`) — Central state holding `dishName`, `members`, and `ingredients`. Exposes `canSubmit` (requires all three), `totalCents`, and a `masterGroceryList` computed getter that aggregates by aisle.
- **Submission form inputs** — `DishNameInput.vue` binds to `dishName`; `GroupMembersInput.vue` manages a dynamic list of member name pills with add/remove.
- **Submit button** — Disabled until `canSubmit` is true (dish name + ≥1 member + ≥1 ingredient). Styled as a black pill.
- **CORS** (`backend/config/initializers/cors.rb`) — Changed from an explicit port list to a regex `/\Ahttp:\/\/localhost(:\d+)?\z/` to allow the Vue dev server on any port.

**Key files:**

| File | Purpose |
|---|---|
| `src/composables/useIngredientSearch.ts` | Debounced search logic, 300ms delay, clears on Escape |
| `src/stores/submission.ts` | All submission state + canSubmit + masterGroceryList |
| `src/components/IngredientSearch.vue` | Search input + dropdown |
| `src/components/IngredientList.vue` | Selected items list + submit button |
| `src/components/DishNameInput.vue` | Team name + dish name inputs |
| `src/components/GroupMembersInput.vue` | Member pills with add/remove |
| `src/api/ingredients.ts` | Fetch wrapper for `GET /api/v1/ingredients?q=` |
| `backend/app/models/ingredient.rb` | Word-split AND search scope |
| `backend/config/initializers/cors.rb` | Regex-based localhost CORS allow |

---

### Step 5 — Submission Flow + Organizer Dashboard (completed)

Built the complete submission lifecycle: teams submit their ingredient list → access code is generated → organizers view all submissions and a live-updating grocery list with checkboxes.

**Why each piece exists:**

- **Access code** — The simplest zero-friction way for a team to return and edit their submission. No email or login required. An 8-char uppercase alphanumeric code is generated server-side on `before_validation`.
- **Token auth for organizers** — Organizers log in with username/password; the server stores a `SecureRandom.hex(32)` token in the `organizers` table and returns it to the frontend. The frontend stores it in `localStorage` and sends it as `Authorization: Bearer <token>` on organizer-only requests.
- **Grocery list aggregation** — The `GET /api/v1/grocery_list` endpoint queries `submission_ingredients` joined to `submissions` and `ingredients`, groups by `ingredient_id`, sums quantities, collects team names, and joins with `grocery_checkins` for checked state. All aggregation is on the server; the frontend just renders.
- **Checkbox persistence** (`grocery_checkins` table) — One row per ingredient across the whole event. `PATCH /api/v1/grocery_list/:ingredient_id` updates the row and broadcasts to `GroceryListChannel`.
- **Real-time sync** — Uses Action Cable via `solid_cable` (SQLite-backed pub/sub, no Redis needed). `GroceryListChannel` broadcasts checkbox changes to all connected organizers. `NotificationsChannel` broadcasts when a new submission arrives, triggering a list refresh.
- **No multi-event support (by design)** — The app is reset between events by deleting submissions and grocery_checkins. The ingredients table is preserved.

**Backend files created:**

| File | Purpose |
|---|---|
| `backend/Gemfile` | Uncommented `bcrypt` for `has_secure_password` |
| `backend/db/migrate/..._create_submissions.rb` | `dish_name`, `team_name`, `notes`, `access_code` (unique) |
| `backend/db/migrate/..._create_submission_ingredients.rb` | Join table: `submission_id`, `ingredient_id`, `quantity` |
| `backend/db/migrate/..._create_organizers.rb` | `username` (unique), `password_digest`, `token` (unique) |
| `backend/db/migrate/..._create_grocery_checkins.rb` | `ingredient_id` (unique), `checked`, `checked_by`, `checked_at` |
| `backend/app/models/submission.rb` | `before_validation :generate_access_code`, associations, validations |
| `backend/app/models/organizer.rb` | `has_secure_password`, `regenerate_token`, `clear_token` |
| `backend/app/controllers/concerns/organizer_authenticatable.rb` | `before_action :require_organizer_auth` reads Bearer token |
| `backend/app/controllers/api/v1/submissions_controller.rb` | `POST /submissions` (create + broadcast), `GET /submissions` (index, organizer only), `GET /submissions/:access_code` (show) |
| `backend/app/controllers/api/v1/organizer_sessions_controller.rb` | `POST /organizer_session` (login), `DELETE` (logout) |
| `backend/app/controllers/api/v1/grocery_list_controller.rb` | `GET /grocery_list` (aggregated), `PATCH /grocery_list/:id` (checkbox + broadcast) |
| `backend/app/channels/grocery_list_channel.rb` | `stream_from "grocery_list"` |
| `backend/app/channels/notifications_channel.rb` | `stream_from "notifications"` |
| `backend/config/routes.rb` | Added `/cable` mount, submissions, organizer_session, grocery_list routes |
| `backend/db/seeds.rb` | Seeds default organizer: `username=organizer`, `password=changeme123` |

**Frontend files created/modified:**

| File | Purpose |
|---|---|
| `src/stores/submission.ts` | Added `teamName`, updated `canSubmit` to require team name, added `reset()` |
| `src/api/submissions.ts` | `createSubmission`, `getAllSubmissions` fetch wrappers |
| `src/api/organizer.ts` | `organizerLogin`, `organizerLogout`, `getGroceryList`, `checkGroceryItem` |
| `src/components/DishNameInput.vue` | Now has two inputs: team name + dish name |
| `src/components/AppPanel.vue` | `dish-name` variant height changed from `h-16` to `h-28` to fit two inputs |
| `src/components/IngredientList.vue` | Submit button wired to `createSubmission`; redirects to `/confirmation/:accessCode` on success |
| `src/views/ConfirmationView.vue` | Displays the access code after a successful submission |
| `src/views/OrganizerLoginView.vue` | Username/password login form; stores token in `localStorage` |
| `src/views/OrganizerDashboardView.vue` | Two-tab view: submissions list (expandable) + grocery list with real-time checkboxes via Action Cable |
| `src/router/index.ts` | Added `/confirmation/:accessCode`, `/organizer/login`, `/organizer` routes |
| `package.json` | Added `@rails/actioncable` for WebSocket client |

**Credentials (development):**
- Organizer login: `username=organizer`, `password=changeme123`
- Change before deploying to production.

---

## Open Questions to Resolve

- **Scraper language:** ✅ Resolved — Python was used. Scraped 13,906 products from Giant; 13,848 imported into SQLite.
- **Magic link vs. short code:** ✅ Resolved — Short code (Option A). No email required. 8-char uppercase alphanumeric generated server-side.
- **Event scoping:** ✅ Resolved (deferred) — No multi-event support for now. Between events, delete all `submissions` and `grocery_checkins` rows. The `ingredients` table is reused as-is.
- **Ingredient quantities on the master list:** ✅ Resolved — Quantities are in pack units (× N packs), matching the unit as listed in the Giant database. No unit conversion is performed.
