# Snap To Home Quote

**Tech:** React + TypeScript + Tailwind + shadcn/ui. No Supabase and no auth: all data comes from an external REST API on Cloudflare Workers. Put the API client in `src/lib/snapquote-api.ts` and image helpers in `src/lib/image-tools.ts` (I will give you their code). Read the base URL from `import.meta.env.VITE_API_BASE_URL`.

**Style:** clean, confident, trustworthy. Dark charcoal header (#16181d), dark slate grey page background (#1e222a), and crisp white cards (#ffffff) with soft borders. Large readable numbers for score and price. Mobile-first. Use construction safety orange (#ea580c) for primary buttons and active steps, warm rust-orange (#c2410c) for secondary accents and price highlights, and a warm light-orange highlight (#ffedd5) with an orange border for selected cards and tags.

## Routes

1. `/` Landing: headline "Snap it. See it. Get it quoted!", one-line subhead, a 3-step strip (Snap → Preview & price → Get contracts), CTA buttons "Get a quote" (→ `/quote`).

2. `/quote` Homeowner flow as a 4-step wizard with a progress bar:

**Step 1 – Upload.** File input + camera capture on mobile, region select (options from `api.config().regions`). Convert the file with `fileToSquareJpeg(file)` and show it in a 512x512 square. On top, a transparent `<canvas width=512 height=512>` at 45% opacity hooked to `createMaskPainter(canvas, () => brushSize)`. Show a brush-size slider and "Clear paint" button, with the hint "Optional: paint over the part to replace for a precise preview." Button **Analyze photo** → `api.analyze(image)`.

**Step 2 – What the AI sees.** Show `item_label`, material, condition badge (good = green, fair = amber, poor = red), quantity, approx dimensions, `visible_issues` as chips, and a red "Possible structural work" chip if `structural_concern`. Show the 3 `replacement_options` as selectable cards (name + prompt as caption) plus a "Something else" card with a text input. Button **Visualize & estimate** calls `api.visualize(image, option.prompt, painter.getMask())` and `api.estimate(detection, option, region)` in parallel with `Promise.all`. Show a skeleton loader with the text "Rendering your preview… (10–20s)".

**Step 3 – Preview & estimate.** Left: a before/after comparison slider (before = original, after = returned image; draggable divider). Under it, a note: inpaint mode → "Replaced only the area you painted", img2img → "Whole-photo restyle. Paint the area for a precise swap." Right: a big feasibility score `/10` colored by value (≥8 green, ≥5 amber, else red) with `feasibility_label` and `rationale`; the price range `$low – $high` with "quantity × unit · region"; a small table (Materials low/high, Labour low/high) and a muted line listing the multipliers; a "Local accuracy" badge from `price.calibration`: if `applied`, show "Adjusted from {samples} signed contracts in your area (×{factor})", otherwise "Learning: {samples}/{needed} local contracts"; two lists, Scope and Materials; "Typical timeline: N days"; "Contractor will confirm: …" from `verify_on_site`.

**Step 4 – Get contracts.** Name and email inputs, button **Pay $49 & send to contractors** → `api.submitJob({...})`. Label it clearly "Demo mode: no card is charged." On success, show a success card with the plan ID and a **Check for contract** button that calls `api.getJob(id)` and shows either "No contract yet, contractors are reviewing your plan" or the company, contract price and note, with an "Accept contract" button that calls `api.acceptContract(id)` and then shows a confirmation toast and an "Accepted" badge.

## Behaviour

Show API errors in a toast with the error message.

And also this file:

# Cloudflare Worker config for the SnapQuote API.

# Deploy: cd backend && npm install && npx wrangler deploy

name = "odd-lab-d694"

main = "src/index.js"

compatibility_date = "2025-09-01"

# Workers AI binding (vision, inpainting, text models)

[ai]

binding = "AI"

# Lock this to your Lovable URL once it is published, e.g. "https://snapquote.lovable.app"

[vars]

ALLOWED_ORIGIN = "*"

# Job storage. Create it once with:

#   npx wrangler kv namespace create JOBS

# then paste the id it prints below and uncomment these lines.

[[kv_namespaces]]

binding = "JOBS"

id = "882bbeca5c544a1aa7a30c4f50d51993"

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://snap-to-home-quote.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/f9f5da9b-043f-4a20-a7d0-6afc863d8cde).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
