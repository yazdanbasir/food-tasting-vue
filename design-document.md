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

Giant's website is a modern JavaScript-rendered SPA (their site uses React), which means traditional HTTP scrapers (like `open-uri` + Nokogiri in Ruby, or Python's `requests` + BeautifulSoup) will not work — they only see the raw HTML before JavaScript runs and the product data is loaded. You need a **browser automation** tool.

**Recommended tool: Playwright (Python or Node)**

Playwright drives a real browser (Chromium, Firefox, or WebKit) programmatically. It waits for JavaScript to execute, handles dynamic content, and lets you interact with the page exactly as a human would. It is actively maintained by Microsoft and significantly more reliable than Puppeteer or Selenium for modern sites.

The scraper should be a standalone script (not part of the Rails app) that:

1. Launches a headless browser via Playwright
2. Navigates to each product category on Giant's site
3. For each product listing, extracts: name, product ID, image, price, size, and aisle
4. Writes the collected data to a JSON or CSV file
5. You then import that file into the Rails database via a seed script or a custom `rake` task

This separation matters: the scraper is brittle by nature (Giant can change their site anytime), so keeping it outside the Rails app means you can update and re-run it independently without touching the rest of the application. You run it once before an event, then import the output.

**Handling site changes:** Playwright allows you to select elements by visible text, ARIA roles, and test IDs — not just CSS class names. This makes your scraper more resilient to layout/style changes. That said, you should expect to update it if Giant does a major redesign. Build it with that reality in mind: keep the selectors well-documented and easy to find and change.

**Re-running before each event:** Add a `scraped_at` timestamp to every row. Your Rails seed/import script should upsert records by `product_id` (insert if new, update if existing). This way re-running the scraper before a new event refreshes prices and availability without duplicating data.

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

This is the mechanism by which submitters can return and edit their submission later. Two viable options:

**Option A: Magic Link (Recommended)**
When a team submits, they provide one email address. The app emails them a unique, one-time-use link. Clicking that link authenticates them as that team's submitter and lets them view and edit their submission. No passwords. Works great for a one-time event. Rails has `ActionMailer` built in; a service like Resend or Postmark handles actual delivery.

**Option B: Short Code**
When a team submits, generate a short alphanumeric code (e.g. `TEAM-4F9X`). Display this on-screen and tell them to save it. Entering this code later retrieves their submission. Simpler to implement but relies on the user saving the code.

Magic links are the better experience for a non-technical audience. The recommendation is to implement Option A.

### Editing a Submission
Once authenticated via magic link (or code), the submitter sees their existing submission pre-filled in the same form. Any saved changes trigger a background notification to the organizer dashboard (see Part 3).

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
| Email | **Resend** (free tier: 3,000 emails/mo) | Simple API, excellent Rails integration, free at this scale |

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

1. **Scraper** — Get Giant's product data into a local database. Nothing else is meaningful without this.
2. **Rails API skeleton** — Set up the Rails project, database schema (`ingredients` table), and the search endpoint.
3. **Ingredient search in Vue** — Wire up the autocomplete search to confirm the pipeline works end to end.
4. **Submissions** — Build the submission form and the Rails model/controller for submissions.
5. **Magic link auth** — Implement email delivery and the link-based access flow.
6. **Organizer auth** — Basic login for organizers.
7. **Organizer dashboard** — Submissions list view and the master grocery list aggregation.
8. **Real-time sync** — Add Action Cable for grocery list checkbox sync and notifications.
9. **Deployment** — Deploy both apps to Render/Netlify and test the full flow in production.
10. **AI suggestions** — Add Claude integration once everything else is stable.

---

## Open Questions to Resolve

- **Scraper language:** Python (Playwright is most mature there) or Node (same Playwright library, closer to your existing JS/TS stack)? Python is the more common choice for scraping work.
- **Magic link vs. short code:** This document recommends magic links, but confirm whether email collection from submitters is acceptable.
- **Event scoping:** Will the app support multiple events over time (e.g. fall semester and spring semester each have their own set of submissions)? If yes, a top-level `Event` model is needed that all submissions belong to. If the app is wiped and re-seeded between events, this can be deferred.
- **Ingredient quantities on the master list:** When two teams both add "Chicken Breast (1 lb pack)", the master list can show "× 3 packs" or "3 lbs". The aggregation unit needs to be consistent — define this before building that feature.
