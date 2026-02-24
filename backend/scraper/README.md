# Giant Food Stores Scraper

Scrapes product data (name, price, size, image, aisle) from giantfoodstores.com.
Run this standalone before each event, then import the output into the Rails database.

---

## Setup (one time)

Requires Python 3.11+.

```bash
cd scraper/

# Create and activate a virtual environment
python3 -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate

# Install dependencies
venv/bin/pip install -r requirements.txt

# Install Playwright's browser binaries (uses real Chrome if available)
venv/bin/playwright install chromium
```

---

## Workflow

### Step 1 — Discover (always run this first)

This fetches the target page, dumps the rendered HTML and all network requests,
and saves them to `output/discover/` for inspection.

```bash
venv/bin/python3 scraper.py --discover https://giantfoodstores.com/groceries/index.html
```

Then:
- Open `output/discover/page.html` in a browser. Use DevTools (F12 → Elements)
  to find the actual CSS selectors for categories, product links, etc.
- Open `output/discover/api_requests.json`. If you see `fetch` or `xhr` calls
  returning JSON product data, you can call those API endpoints directly from
  the scraper instead of parsing HTML — much more reliable. Note the URLs and
  any auth headers they send.

### Step 2 — Update selectors

Open `config.py` and update the `SELECTORS` dict to match what you found.

### Step 3 — Run the full scrape

```bash
venv/bin/python3 scraper.py --run
```

The scraper opens a visible Chrome window, navigates category by category,
and scrapes each product detail page. Progress is saved every 25 products to
`output/progress.json`. If it's interrupted, just run `--run` again and it
picks up where it left off.

When done, `output/products.json` contains all scraped products.

### Step 4 — Import into Rails

From the Rails project root:

```bash
rake import:products
```

(This rake task reads `scraper/output/products.json` and upserts records into
the `ingredients` table by `product_id`.)

### Reset and start fresh

```bash
venv/bin/python3 scraper.py --reset
venv/bin/python3 scraper.py --run
```

---

## If you get blocked

The scraper runs in a visible browser window (headless: false) with stealth
patches applied. This is enough for many sites, but Cloudflare may still
challenge you.

**Option A — Solve the CAPTCHA manually**
The scraper will pause and ask you to press Enter after solving it in the
open browser window. This works for occasional challenges.

**Option B — Add a residential proxy**
Open `config.py` and set:

```python
PROXY = "http://user:pass@proxy-host:port"
```

Bright Data, Oxylabs, and Smartproxy all work. A single scrape run uses
very little bandwidth (< 1 GB) — typical cost under $2 on pay-as-you-go plans.

**Option C — Use the mobile app API**
If you intercepted clean JSON API calls in `output/discover/api_requests.json`,
those are worth calling directly via `requests` or `httpx` — no browser needed,
no bot detection to worry about.

---

## Output format

`output/products.json` — array of product objects:

```json
[
  {
    "product_id": "12345",
    "name": "Chicken Breast Boneless Skinless",
    "price_cents": 699,
    "size": "1 lb",
    "image_url": "https://...",
    "aisle": "A3",
    "source_url": "https://giantfoodstores.com/...",
    "scraped_at": "2025-09-01T14:32:00"
  },
  ...
]
```

Price is stored as integer cents (699 = $6.99) to avoid floating point issues.
