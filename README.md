# Logitech Pricelist

The Logitech pricelist used by Iontech, Inc., the Logitech distributor in the Philippines, for its dealers and sales team. It is a single-page web app on GitHub Pages. Dealers browse and export current SRP and Dealer Price (DP). Admins edit the catalog in the browser and publish changes to this repository.

**Live pricelist:** https://raffyrojo.github.io/logitech-pricelist/

---

## Features

### Public pricelist

| Feature | What it does |
|---|---|
| Browse by category | Category tiles (All Products, Mice, Keyboards, Combos, Webcams, and so on) filter the catalog. Colour variants of one product appear as one card with swatches. |
| Search | Matches product name, category, description, model, part number, material number, colour and UPC. The search panel shows **Top Searches** collected across all visitors. If none are available it suggests categories instead. |
| Grid / List views | Grid shows product cards. List shows a sortable table. The choice is remembered on the device. |
| Sort | Featured, Product Name (A–Z / Z–A), SRP (Low → High / High → Low). |
| Product details | Opening a product shows its description, specifications, system requirements, dimensions, warranty and variants. |
| Price changes | For 15 days after a published SRP/DP change, the SKU's card and list row show a **"↕ Price change"** badge and the previous price struck through beside the current price. See [Price Changes](#price-changes). |
| Exports | The Export menu downloads the **current filtered view** as Excel (.xlsx), Excel + Specs (.xlsx), PDF (Catalog) or PDF (Grouped Catalog). |

### Admin tools

Open the Admin panel with the person icon in the header (sign-in required).

| Tab | Purpose |
|---|---|
| Dashboard | Overview of the catalog. |
| SKU Management | Add, edit, duplicate and delete products and their colour variants. |
| Categories | Category list, derived automatically from the products. |
| Price Lists | Links to the pricelist outputs and saved snapshots. |
| Import / Export | Bulk add or update SKUs from .xlsx/.csv (preview of Added / Updated / Skipped / Failed before anything is applied); export all SKUs in the same format. |
| Bulk Price Update | Update SRP/DP for many SKUs from one Excel/CSV file, matched by Part Number. |
| Price Changes | Review price changes: pending, badge on, or badge expired. |
| Popup Ads | Announcement popups and how often they show. |
| Version History | Snapshots saved in this browser that you can restore or download. |
| Settings | Admin settings. |
| **Save** button (top bar) | Publishes the current draft to the live site. |
| **Users** button (top bar) | Manage publish accounts (needs the owner or an admin-role account). |

---

## Admin workflow

```
Edit (manual SKU edit / Bulk Price Update / Import)  →  Draft  →  Save (top bar)  →  Live
```

| Step | Actual behaviour |
|---|---|
| **Draft** | All edits change the copy of the catalog loaded in your browser. "● Unsaved changes" means the draft differs from what you last saved. Dealers see nothing until you publish. Reloading the page reloads live data and discards unpublished edits. |
| **Manual SKU edit** | SKU Management → Edit. Only the fields you change are written. Everything else on the record stays as it was, including model, per-variant channel and carton, and price-change records. Edited SKUs keep their position in the list. Product Name, Category and at least one variant are required. |
| **Bulk Price Update** | 1. Download the template (pre-filled with current SRP/DP). 2. Edit prices. 3. Upload the .xlsx/.csv. 4. Review the preview. 5. Click **Apply Price Updates**. Rows match on **Part Number only**. See the rules below. Apply only changes the draft; it never publishes. |
| **Save (top bar) = Publish** | Checks the draft and compares it with the live data (+added / −removed / ~edited). It keeps a backup of the live data on this device, asks you to confirm, and then commits `data/products.json` (plus any new images) to `main`. The live site updates within about 1–2 minutes. |
| **Version History → Save / Save as new version** | Stores a snapshot **in this browser only** (IndexedDB) for restore or download. Does **not** publish. |

**Bulk Price Update rules**

| Situation | Result |
|---|---|
| Blank SRP or DP cell | That price is kept. |
| DP ≥ SRP (both priced) | **Invalid**, blocked to protect channel pricing. |
| Non-numeric or ≤ 0 price | **Invalid**. |
| Part Number not in catalog | **No Match**, skipped. |
| Same as current price | **Unchanged**, nothing applied. |

**Publish checks**

| Type | Checks |
|---|---|
| Blocking errors | Missing part number, name or category; duplicate part numbers; SRP or DP not a number above 0. |
| Warnings (you can still publish) | DP higher than SRP; unusually high SRP. |
| Extra confirmation | Removing a large number of live products. |

---

## Price Changes

A SKU is flagged only when a publish **succeeds** and its SRP or DP **actually differs** from the live price at that moment.

**How it looks on the public pricelist**

| Where | Display |
|---|---|
| Grid card | "↕ Price change" badge on the image. The previous price appears smaller, muted and struck through beside the current price, e.g. ~~₱4,910.00~~ **₱4,995.00**. The current price keeps its normal size and colour. |
| List row | Same badge next to the product name. The SRP and DP cells show the previous price struck through beside the current price. |
| Which field | Only the field that changed. If only DP moved, SRP shows the current price alone. |
| Colour variants | A card shows the change for the **selected** colour only; switching colour updates the badge and prices. In the list, each SKU row shows its own change. |

There is no separate public Price Changes tile or page.

| Rule | Behaviour |
|---|---|
| Start | On a successful publish, the SKU gets `pSrp`/`pDp` (the live prices **immediately before** the change) and an internal `priceUpdatedAt` timestamp. Draft edits and failed publishes set nothing. |
| Visible for | **15 days (360 hours)** from `priceUpdatedAt`. The badge and the struck-through previous price both use this rule. |
| Expiry | At exactly 360 hours the badge and previous price are hidden and only the current price remains, even on a page that is already open (no refresh needed). |
| Another price change | Restarts the 15 days. "Previous" becomes the price that was live just before the new change. |
| Unrelated publish | Description edits, other SKUs, or re-uploading the same prices do **not** restart the timer. |
| After expiry | The record stays in **Admin → Price Changes** as "Badge expired". |
| Clear (Admin) | Removes a record. The public badge and previous price disappear after the next Save. |

**Admin → Price Changes** lists every SKU with a pending or published price change: previous vs current SRP and DP, which field changed, and a status of *Pending publish*, *Badge on* (time left) or *Badge expired*. You can search by part number or product name.

The timestamp is not shown publicly. There is no effective-date field.

---

## Repository structure

| Path | Purpose |
|---|---|
| `index.html` | The whole app: public pricelist, Admin panel, export engines (Excel/PDF) and styles. It contains no product data. |
| `data/products.json` | The catalog. One record per SKU: `code, name, category, model, color, srp, dp, upc, material, channel, warranty, carton, desc, specs, sysreq, dim`, plus optional price-change fields `pSrp, pDp, priceUpdatedAt`. Written by Admin publishes. |
| `data/categories.json` | Category list with SKU counts. |
| `data/settings.json` | Site metadata (data revision, default view, brand labels). |
| `images/<code>.webp` | Product images, one per part number. |
| `js/config.js` | Configuration: repository, branch, publish endpoint and data paths. It also contains the startup check that tells visitors when published data has changed. |
| `js/publish.js` | Admin **Save** button: checks, live-data comparison, pre-publish backup, price-change stamping, and the commit request. |
| `js/users.js` | Admin **Users** panel for publish accounts. |
| `css/brand.css` | Logitech brand styling (token overrides). Restyle here rather than inline in `index.html`. |
| `.nojekyll` | Tells GitHub Pages to serve files as-is. |

---

## Deployment

The site is served by **GitHub Pages from the root of `main`**. There is no build step.

| Change | How it reaches the site |
|---|---|
| Prices, products, images | Admin → **Save**. This commits `data/products.json` (and new images) to `main`. |
| App code (`index.html`, `js/*`, `css/*`) | Commit the updated file to `main`. Pages redeploys within about 1–2 minutes. |

Notes:

- `index.html` loads `data/products.json` fresh on every visit. The browser's IndexedDB copy is used only as an offline fallback.
- `index.html` may be cached for up to 10 minutes, so an open tab picks up code changes after one refresh.
- When you change `js/config.js`, `js/publish.js`, `js/users.js` or `css/brand.css`, bump its `?v=` query string where `index.html` loads it, so browsers fetch the new file.
- Publishing needs the serverless publish endpoint set in `js/config.js` and a publish passphrase. Passphrases and tokens are never stored in this repository.

---

## Troubleshooting

| Problem | What to check |
|---|---|
| Prices look out of date | Refresh the page. Data loads fresh each visit; code updates can take one refresh (up to ~10 min of cache). |
| Publish says "Wrong passphrase" | Nothing was published. Click Save again and re-enter your passphrase. |
| Publish fails with 403 / 413 / 429 / 5xx | 403: site origin not allowed by the publish service. 413: too much data, so publish fewer new images at once. 429: wait a minute. 5xx: try again later. Your draft is kept in all cases. |
| Publish timed out | Check the latest commit on `main` before retrying. The publish may or may not have gone through. |
| Need the data from before a publish | In the browser console, run `cmsDownloadBackup()` to download the live data saved just before the last publish, then re-import it via Admin. |
| Price change badge or previous price not showing | They appear only after a **successful** publish where SRP or DP actually changed, and only for the selected colour on a card. Check Admin → Price Changes: "Pending publish" means it isn't live yet; "Badge expired" means the 15 days have passed. |
| Edits disappeared after reload | Unpublished draft edits are not kept across reloads. Save (publish) before closing, or use Version History to keep a local snapshot. |
