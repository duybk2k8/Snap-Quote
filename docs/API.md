# SnapQuote API

Base URL: your Worker, e.g. `https://odd-lab-d694.<subdomain>.workers.dev`. All bodies are JSON. Errors return `{ "error": "message" }` with a 4xx/5xx status. CORS is open (`ALLOWED_ORIGIN` in `wrangler.toml`).

Images are data URLs. Send 512x512 images; masks are 512x512 PNGs, white = replace, black = keep.

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| GET | `/api/config` | – | `{ regions: string[], storage: "kv" \| "memory", ai: boolean }` |
| POST | `/api/analyze` | `{ image }` | `{ detection }` (stage 1, Llama 3.2 Vision) |
| POST | `/api/visualize` | `{ image, prompt, mask? }` | `{ image, mode: "inpaint" \| "img2img" }` (stage 2, Stable Diffusion) |
| POST | `/api/estimate` | `{ detection, option, region }` | `{ estimate }` (stage 3, price book + Llama 3.3) |
| POST | `/api/jobs` | `{ name, email, region, detection, option, estimate, before, after }` | `{ job: { id, status } }` ($49 demo payment) |
| GET | `/api/jobs` | – | `{ jobs: Job[], stats: { total, contracts, fees, avgDeltaPct } }` |
| GET | `/api/jobs/:id` | – | `{ job }` |
| POST | `/api/jobs/:id/contract` | `{ company, price, note }` | `{ job }` |

Types are defined in `frontend/src/lib/snapquote-api.ts`.

## Example: detection

```json
{
  "item_type": "window",
  "item_label": "Double-hung wood window",
  "material": "wood",
  "condition": "poor",
  "visible_issues": ["peeling paint", "cracked sill"],
  "quantity": 2,
  "approx_dimensions": "36 x 60 in",
  "structural_concern": false,
  "replacement_options": [
    { "name": "Black vinyl casement", "prompt": "a black vinyl casement window with slim frame" }
  ]
}
```

## How pricing works

`price = (material + labour per unit) × quantity × region × condition × structural`, rounded to $50. The price book and region multipliers sit at the top of `backend/src/index.js` and are demo values. The LLM writes the feasibility text but never sets the price; a structural flag caps the score at 6/10.
