# SnapQuote API

Base URL: your Worker, e.g. `https://odd-lab-d694.<subdomain>.workers.dev`. All bodies are JSON. Errors return `{ "error": "message" }` with a 4xx/5xx status. CORS is open (`ALLOWED_ORIGIN` in `wrangler.toml`).

Images are data URLs. Send 512x512 images; masks are 512x512 PNGs, white = replace, black = keep.

## Flow

1. A company signs up and shares its link `/c/<slug>` with customers instead of sending an inspector.
2. The homeowner quotes for free, as often as they like: analyze → visualize → estimate.
3. The homeowner sends a free request to the company.
4. The company finalizes the contract with the repair price. The quote fee is added automatically.
5. The homeowner pays repair price + quote fee. Only now does the job become anonymous learning data.

## Endpoints

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| GET | `/api/config` | – | `{ regions, storage, ai, pricing }` |
| POST | `/api/analyze` | `{ image, region? }` | `{ detection, local }` stage 1, free |
| POST | `/api/visualize` | `{ image, prompt, mask? }` | `{ image, mode }` stage 2, free |
| POST | `/api/estimate` | `{ detection, option, region }` | `{ estimate }` stage 3, free |
| GET | `/api/quote-fee?email=` | – | `{ quoteFee: { fee, base, discountPct, completedJobs, nextFee, floor } }` |
| POST | `/api/companies` | `{ name, city?, email?, trades? }` | `{ company }` |
| GET | `/api/companies` | – | `{ companies }` (no emails) |
| GET | `/api/companies/:slug` | – | `{ company }` |
| POST | `/api/jobs` | `{ company?, name, email, region, detection, option, estimate, before, after }` | `{ job: { id, status: "requested", quoteFee } }` free request |
| GET | `/api/jobs?company=` | – | `{ jobs, stats }` company dashboard |
| GET | `/api/jobs/:id` | – | `{ job }` |
| POST | `/api/jobs/:id/contract` | `{ repairPrice, note? }` | `{ job }` status `contract_sent`, contract has `repairPrice, quoteFee, discountPct, total` |
| POST | `/api/jobs/:id/pay` | `{}` | `{ job }` status `paid`, `billing` + `nextQuoteFee` (alias `/accept`) |
| GET | `/api/insights` | – | `{ totals, calibration, options, minSamples }` |

Types are defined in `frontend/src/lib/snapquote-api.ts`.

## Pricing rules (`backend/src/config.js`)

| Setting | Value | Meaning |
| --- | --- | --- |
| `QUOTE_FEE` | $25 | Added to every finalized contract |
| `LOYALTY_DISCOUNT` | 10% | Each paid repair cuts the homeowner's next quote fee by 10%, compounding: $25 → $22.50 → $20.25 → $18.23 … |
| `QUOTE_FEE_FLOOR` | $12.50 | Lowest possible quote fee |
| `PLATFORM_COMMISSION` | 20% | SnapQuote's share of the quote fee; the company gets the rest plus the full repair price |
| `COMPANY_PLAN_FEE` | $1,200/month | Fixed fee each company pays SnapQuote (billed outside the API in this demo) |

Loyalty is tracked per homeowner by a SHA-256 hash of their email (`customer:<hash>`), across all companies.

Payments are demo-only. In production, use Stripe Connect: the homeowner pays the total, the company receives it directly, and SnapQuote's commission is taken as the application fee.

## Estimate pricing

`price = (material + labour per unit) × quantity × region × condition × structural × learned`, rounded to $50. The price book and region multipliers sit in `backend/src/config.js` and are demo values. The LLM writes the feasibility text but never sets the price; a structural flag caps the score at 6/10.

## Data moat (learning from finalized jobs only)

A job becomes learning data **only when it is paid** (request sent and contract finalized). Requests that never close are not stored as learning data. Each paid job writes `data:<id>`: item type, region, condition, quantity, structural flag, chosen option, estimate range and repair price. No name, email or photos.

Future quotes use it in two ways:

- **Price correction.** Each paid job adds `repair price ÷ uncorrected estimate midpoint` to `calib:<item_type>|<region>`. Once an area has 3 paid jobs, new estimates there are multiplied by the average ratio (clamped 0.7–1.4), shown as `multipliers.learned` and `calibration`.
- **Local context for generation.** `/api/analyze` (with `region`) marks or adds the option most bought nearby (`localFavorite`), and `/api/estimate` gives the LLM the local average paid price and most-chosen options, returned as `estimate.local`.
