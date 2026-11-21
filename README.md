# SnapQuote

Snap a photo, see the replacement, get it quoted! SnapQuote turns your photo into a priced, visualized, contractor-ready repair plan. Built for CaseHacks Hackday 2026.

- **Front end:** Lovable (React + Tailwind), built in Lovable ([Lovable Dashboard](https://lovable.dev/dashboard))
- **Back end:** Cloudflare Worker + Workers AI + KV, in `backend/`

```
SnapQuote/
├── backend/                 Cloudflare Worker (JSON API + AI pipeline)
│   ├── src/index.js
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

- The $49 payment is a demo. Swap in Stripe Checkout for production.
- Prices come from a demo price book in `backend/src/index.js`; replace with real regional data.
- First vision call accepts the Llama 3.2 license automatically.
