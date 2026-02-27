# Backend Technical Flow

A running log of every change made to the backend, in order. Each entry explains what was done, why, and which files were touched.

---

## 11. Kitchen & Utensils allocation table

**What:** Added a Kitchen & Utensils allocation table to the Organizer Dashboard. Three new columns were added to the `submissions` table: `utensils_notes` (text — teams describe what equipment they need, filled on the public form), `equipment_allocated` (string — organizer assigns equipment), and `helper_driver_needed` (string — organizer notes whether a helper or driver is needed). A new dedicated PATCH endpoint `submissions/by_id/:id/kitchen_allocation` was added so the organizer can update only the kitchen-specific fields surgically (cooking_location, equipment_allocated, helper_driver_needed) without touching ingredients or triggering the full update logic. The existing `update` action was extended to also accept `utensils_notes` from the public form.

**Note on `cooking_location` dual use:** On the public form, teams fill in `cooking_location` only when they have their own kitchen (`has_cooking_place = 'yes'`). In the kitchen table, the organizer also uses this same field to assign a cooking station to teams that need one. Same column, intentional dual use.

**Why:** The Kitchens & Utensils tab was a placeholder. Organizers need to track which teams bring their own kitchen, what equipment needs to be procured, where each team will cook, and whether any team needs a helper or driver. All editable cells write back to the database immediately on blur/Enter with optimistic updates and error rollback.

**Files modified:**
- `db/migrate/20260226200000_add_kitchen_fields_to_submissions.rb` — new migration (3 columns)
- `app/controllers/api/v1/submissions_controller.rb` — new `kitchen_allocation` action, `utensils_notes` in create/update, 3 new fields in `submission_json`
- `config/routes.rb` — added `PATCH submissions/by_id/:id/kitchen_allocation` route

**Frontend files modified:**
- `src/api/submissions.ts` — extended `SubmissionResponse` and `SubmissionPayload` with new fields
- `src/api/organizer.ts` — added `KitchenAllocationPayload` interface and `updateKitchenAllocation` function
- `src/stores/submission.ts` — added `utensilsNotes` ref, wired into reset/loadForEdit/return
- `src/views/HomeView.vue` — activated the utensils text input on Page 2, wired into payload
- `src/views/OrganizerDashboardView.vue` — full kitchen table (7-column CSS grid, inline edit, add row)

---

## 8. Fixed empty search returning results

**What:** Added a guard in the search endpoint so that if no query (or fewer than 2 characters) is provided, it returns an empty array immediately instead of hitting the database.

**Why:** Without this fix, calling `/api/v1/ingredients` with no `?q=` parameter would return 20 random products from the full 13,848-item table. That's wasted work and meaningless to the frontend. The autocomplete search should only fire once the user has typed something meaningful.

**Files modified:**
- `app/controllers/api/v1/ingredients_controller.rb` — added early return for blank or short queries

---

## 9. Moved the scraper into the backend

**What:** Moved the entire `scraper/` folder from the project root into `backend/scraper/`.

**Why:** The scraper's only job is to produce data for the backend. Keeping it alongside the Rails app makes the relationship explicit and keeps all backend-related tooling in one place. The `giant-inventory.db` file in `backend/storage/` remains the authoritative import source — the import rake task points there unchanged.

**Files modified:**
- `backend/scraper/` — scraper folder now lives here (moved from project root)

---

## 1. Changed the default server port to 1826

**What:** Told the web server (Puma) to listen on port 1826 instead of the default 3000.

**Why:** Avoids conflicts with other Rails apps or services that commonly use 3000. When you start the server with `rails server`, it will be reachable at `http://localhost:1826`.

**Files modified:**
- `config/puma.rb` — changed `PORT` default from `3000` to `1826`

---

## 2. Enabled CORS (Cross-Origin Resource Sharing)

**What:** Uncommented and installed the `rack-cors` gem, then configured it to allow requests from the Vue frontend.

**Why:** Browsers block requests from one origin (e.g. `localhost:5173` — the Vue dev server) to a different origin (e.g. `localhost:1826` — the Rails API) by default. Without CORS configured, every API call from the frontend would be silently rejected by the browser. This config tells the browser "yes, it's okay for the frontend to talk to this API."

**Files modified:**
- `Gemfile` — uncommented `gem "rack-cors"`
- `config/initializers/cors.rb` — configured allowed origins (`localhost:5173`, `localhost:4173`). When deploying to production, add the live frontend URL here.

---

## 3. Created the ingredients database table

**What:** Created a migration that defines the `ingredients` table — the Rails-managed database table that will hold all Giant product data.

**Why:** Rails needs its own database table to work with the data. The scraper produces a raw SQLite file (`giant-inventory.db`), but Rails can't use that directly — it needs the data in its own structured table so it can query, filter, and serve it through the API.

The table stores:
- Product identity: `product_id` (Giant's internal ID), `name`, `size`, `aisle`, `category`, `image_url`
- `price_cents` — price as an integer (e.g. $3.49 → 349). Avoids floating-point rounding bugs that come from storing prices as decimals.
- 10 dietary boolean flags: `gluten`, `dairy`, `egg`, `peanut`, `kosher`, `vegan`, `vegetarian`, `lactose_free`, `wheat_free`, `is_alcohol`
- `scraped_at` — timestamp for when the data was last synced from Giant

**Files modified:**
- `db/migrate/20260222143944_create_ingredients.rb` — defines the table schema
- `db/schema.rb` — auto-updated by Rails after running the migration

---

## 4. Created the Ingredient model

**What:** Created the Ruby class that represents a single ingredient record and handles interaction with the database.

**Why:** In Rails, every database table needs a corresponding model class. The model is where business logic lives — validations (e.g. every ingredient must have a name), named queries (the `search` scope), and convenience methods (the `price` helper that returns the dollar amount from cents).

**Files modified:**
- `app/models/ingredient.rb`

---

## 5. Created the API controller and routes

**What:** Created the controller that handles incoming HTTP requests for ingredients, and registered the API endpoints in the router.

**Why:** The controller is the part of Rails that receives a request, talks to the database, and sends back a JSON response. Two endpoints were created:

- `GET /api/v1/ingredients?q=chicken` — searches by name, returns up to 20 matches. This is what the Vue autocomplete search will call as the user types.
- `GET /api/v1/ingredients/:id` — returns a single ingredient by its Rails ID.

The response format nests all dietary flags under a `dietary` key to keep the JSON clean and easy to work with on the frontend.

**Files modified:**
- `app/controllers/api/v1/ingredients_controller.rb` — search and show actions
- `config/routes.rb` — registered the two endpoints under `/api/v1/ingredients`

---

## 6. Created the import rake task

**What:** Created a `rails import:ingredients` command that reads from the scraper's raw SQLite database and loads all product data into the Rails ingredients table.

**Why:** The scraper produces `storage/giant-inventory.db` — a raw file with 13,848 products. The import task is the bridge between that file and the Rails app. It upserts by `product_id` (Giant's ID), meaning:
- New products get inserted
- Existing products get their price, aisle, and other fields updated
- Nothing gets duplicated

This means you can re-run the scraper before each event, drop the new DB into `backend/storage/`, run `rails import:ingredients`, and the Rails database is up to date.

**Files modified:**
- `lib/tasks/import_ingredients.rake` — the import task

---

## 7. Moved the scraper database and ran the import

**What:** Copied `giant-inventory.db` from `scraper/` into `backend/storage/`, ran the migration to create the table, then ran the import task to populate it.

**Why:** The data needed to be in the Rails database before the API could serve anything. After this step, all 13,848 Giant products are live in `backend/storage/development.sqlite3` and queryable through the API.

**Result:** `GET http://localhost:1826/api/v1/ingredients?q=chicken` returns matching products as JSON.

**Files modified:**
- `backend/storage/giant-inventory.db` — scraper source database (added)
- `backend/storage/development.sqlite3` — Rails app database, now populated with 13,848 ingredients

---

## 10. Built the Vue UI shell

**What:** Converted the React UI reference (`ui-reference/`) into Vue 3 SFCs. Static layout only — no reactive state or API calls yet.

**Why:** Establishes the visual structure and component architecture before wiring in functionality. Using a generic `AppPanel` component for every section keeps the layout DRY and makes it easy to slot in content piece by piece without restructuring anything.

**Component architecture:**

- `AppHeader.vue` — header with ISA logo and event name (center) and Form/Submissions links (right).
- `AppPanel.vue` — generic panel used for all five sections. Props: `title`, `variant`, `collapsible`, `expanded`. Emits `toggle`. Accepts a default slot for body content. The `variant` prop controls which CSS flex rules apply and maps to the exact class structure from the reference.

**Files modified:**
- `src/components/AppHeader.vue` — new
- `src/components/AppPanel.vue` — new
- `src/assets/logos/ISA-logo.png` — copied from `ui-reference/public/`
- `index.html` — added Roboto Mono Google Fonts link, updated page title
- `src/assets/base.css` — full-height `html/body/#app`, Roboto Mono as default font, removed Vue boilerplate background/color
- `src/views/HomeView.vue` — top bar (country, dish name, members) + main column (search, grocery list)
- `package.json` — added `sass` dev dependency for `<style lang="scss">` in SFCs
