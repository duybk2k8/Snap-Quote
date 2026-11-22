# SnapQuote

Snap a photo, see the replacement, get it quoted! SnapQuote turns your photo into a priced, visualized, contractor-ready repair plan. Built for CaseHacks Hackday 2026.

Home-service companies send their customers to SnapQuote instead of sending an inspector to the house. Homeowners quote for free, as often as they like, then send a free request. When the company finalizes the contract, the homeowner pays the repair price plus a $25 quote fee, which drops 10% after every completed repair.

- **Front end:** Lovable (React + Tailwind), built in Lovable ([Lovable Dashboard](https://lovable.dev/dashboard))
- **Back end:** Cloudflare Worker + Workers AI + KV, in `backend/`
- **More information** [Snap Quote](https://docs.google.com/document/d/1zMvyyWeTOoS4sw7ibXwr9S0aDKrNioOqW6QYL5X97g0/edit?usp=sharing)

```
SnapQuote/
├── backend/                 Cloudflare Worker (JSON API + AI pipeline)
│   ├── src/
│   │   ├── index.js         Router: path → feature handler
│   │   ├── config.js        Models, price book, regions, pricing rules
│   │   ├── features/
│   │   │   ├── analyze.js   Stage 1: vision analysis
│   │   │   ├── visualize.js Stage 2: inpainting / img2img preview
│   │   │   ├── estimate.js  Stage 3: price book + feasibility summary
│   │   │   ├── jobs.js      Free requests, contract finalize, payment
│   │   │   ├── billing.js   $25 quote fee, loyalty discount, commission split
│   │   │   ├── companies.js Company signup and public links
│   │   │   └── insights.js  Data moat: learns from paid jobs only
│   │   └── lib/
│   │       ├── storage.js   KV with in-memory fallback
│   │       └── utils.js     JSON/CORS, parsing, base64
│   ├── wrangler.toml        AI binding, KV binding, CORS origin
│   └── package.json
├── frontend/                What goes into Lovable
│   ├── LOVABLE_PROMPT.md    Paste into Lovable to generate the UI
│   └── src/lib/
│       ├── snapquote-api.ts Typed API client
│       └── image-tools.ts   512x512 crop + mask painter
└── docs/API.md              Endpoint reference
```

## AI pipeline

| Stage | Model | Output |
| --- | --- | --- |
| 1. Vision analysis | `@cf/meta/llama-3.2-11b-vision-instruct` | Item, material, condition, quantity, structural risk, 3 replacement options (JSON) |
| 2. Visualization | `@cf/runwayml/stable-diffusion-v1-5-inpainting` (img2img fallback) | Before/after preview |
| 3. Feasibility + price | Price book + `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | Score /10, price range, scope, materials, timeline |

## Business model

| Who | Pays | When |
| --- | --- | --- |
| Homeowner | Nothing | Quoting and sending requests are free |
| Homeowner | Repair price + $25 quote fee | Only after the company finalizes the contract |
| Homeowner (returning) | Quote fee −10% per completed repair, compounding, floor $12.50 | Next contract |
| Company | $1,200/month plan | Fixed, to use SnapQuote with its customers |
| SnapQuote keeps | 20% of each quote fee + the monthly plans | On every paid job |

All values live in `backend/src/config.js`.

## Data moat

Only jobs that were requested **and** finalized (paid) become learning data, stored anonymously (no names, emails or photos). Future quotes use it to correct local prices after 3 paid jobs in an area and to surface what nearby homeowners actually bought. Details in `docs/API.md`.

## 1. Deploy the back end

```bash
cd backend
npm install
npx wrangler login
npx wrangler kv namespace create JOBS   # copy the id into wrangler.toml and uncomment the block
npx wrangler deploy
```

The deploy prints your URL, e.g. `https://odd-lab-d694.<subdomain>.workers.dev`. Check it: open `/api/config` and confirm `"ai": true`.

Deploying with Wrangler replaces any code pasted in the Cloudflare dashboard editor for this Worker.

## 2. Build the front end in Lovable

1. Create a new Lovable project and paste the prompt from `frontend/LOVABLE_PROMPT.md`.
2. Give Lovable the two files in `frontend/src/lib/` (paste their contents and ask it to create them at the same paths).
3. Set the API URL: in Lovable, add `VITE_API_BASE_URL=https://odd-lab-d694.<subdomain>.workers.dev`, or edit the fallback at the top of `snapquote-api.ts`.
4. Publish. Then set `ALLOWED_ORIGIN` in `backend/wrangler.toml` to your Lovable URL and redeploy.

Lovable creates and syncs its own GitHub repo, so the generated UI code lives there, not in this repo.

## Local development

```bash
cd backend
npm run dev     # wrangler dev --remote (Workers AI runs on Cloudflare)
```

## Notes

- Payments are a demo. In production use Stripe Connect: money goes to the company, SnapQuote's commission is the application fee.
- Prices come from a demo price book in `backend/src/config.js`; replace with real regional data.
- First vision call accepts the Llama 3.2 license automatically.
