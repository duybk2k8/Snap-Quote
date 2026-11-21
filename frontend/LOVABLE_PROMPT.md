# Prompt to paste into Lovable

Copy everything below the line into Lovable. If you already have a SnapQuote project in Lovable, paste it as a change request ("Update the app to this spec"). Then paste in the two files from `frontend/src/lib/` (or ask Lovable to create them with that content), and set the API URL.

---

Build **SnapQuote**: home-service companies (windows, doors, roofing, cabinets, HVAC, siding, flooring, fences) send their customers to SnapQuote instead of sending an inspector to the house. The homeowner snaps a photo, previews the replacement on their own home and gets an AI feasibility score and price range **for free**, as many times as they like. They then send a **free request** to the company. When the company finalizes the contract, the homeowner pays the **repair price + a $25 quote fee**. Every completed repair cuts that homeowner's next quote fee by 10% (down to a floor).

**Tech:** React + TypeScript + Tailwind + shadcn/ui. No Supabase and no auth: all data comes from an external REST API on Cloudflare Workers. Put the API client in `src/lib/snapquote-api.ts` and image helpers in `src/lib/image-tools.ts` (I will give you their code). Read the base URL from `import.meta.env.VITE_API_BASE_URL`.

**Style:** clean, confident, trustworthy. Dark charcoal header (#16181d), off-white background (#f6f5f2), white cards with soft borders, one blue accent (#1f6feb). Large readable numbers for score and price. Mobile-first.

## Routes

1. `/` Landing: headline "Snap it. See it. Get it quoted.", subhead "Free photo quotes from local pros. No site visit.", a 4-step strip (Snap → Preview & price free → Send a free request → Pay only when your contract is final), and a pricing note: "Quoting is free. A $25 quote fee is added only to finalized contracts, and it drops 10% every time you complete a repair." CTAs "Get a free quote" (→ `/quote`) and "For companies" (→ `/companies`).

2. `/companies` For companies: explain "Stop driving to houses that never buy. Send customers your SnapQuote link and receive pictured, priced requests." Show pricing from `api.config().pricing`: "${companyPlanFee}/month plan + you keep {100 − platformCommissionPct}% of every quote fee." A **savings calculator** card: inputs "Jobs you close per month" (default 40), "Your in-home close rate %" (default 29), "Cost of one site visit $" (default 183). Show: visits needed = jobs ÷ close rate; inspection cost = visits × visit cost; SnapQuote cost = companyPlanFee + 25% of (jobs ÷ 0.67) site checks × visit cost + (jobs ÷ 0.67) × 15 min × $53/h − jobs × $22 × (1 − platformCommissionPct/100); and the saving in $ and %, plus "The plan pays for itself after {ceil(companyPlanFee ÷ visit cost)} avoided visits." Caption: "Defaults: BLS estimator wages, IRS mileage, 29% Windows & Doors close rate." Then a signup form (company name, city, email, trades as checkboxes) → `api.createCompany(...)`. On success show the company's customer link `/c/{slug}` with a Copy button, and a button to its dashboard `/dashboard/{slug}`. Below, list existing companies from `api.listCompanies()` with links.

3. `/c/:slug` Company-branded quote page: load `api.getCompany(slug)`, show "Get a free quote from {company.name}" in the header, then render the same quote flow as `/quote` with `company = slug`.

4. `/quote` (and inside `/c/:slug`) Homeowner flow as a 4-step wizard with a progress bar:
   - **Step 1 – Upload.** File input + camera capture on mobile, region select (options from `api.config().regions`). Convert the file with `fileToSquareJpeg(file)` and show it in a 512x512 square. On top, a transparent `<canvas width=512 height=512>` at 45% opacity hooked to `createMaskPainter(canvas, () => brushSize)`. Brush-size slider, "Clear paint" button, hint "Optional: paint over the part to replace for a precise preview." Button **Analyze photo (free)** → `api.analyze(image, region)`.
   - **Step 2 – What the AI sees.** Show `item_label`, material, condition badge (good = green, fair = amber, poor = red), quantity, approx dimensions, `visible_issues` as chips, and a red "Possible structural work" chip if `structural_concern`. Show `replacement_options` as selectable cards (name + prompt as caption). If an option has `localFavorite`, add a badge "Chosen by {localFavorite} homeowners nearby". Add a "Something else" card with a text input. Button **Visualize & estimate** calls `api.visualize(image, option.prompt, painter.getMask())` and `api.estimate(detection, option, region)` in parallel with `Promise.all`. Skeleton loader: "Rendering your preview… (10–20s)". The homeowner can go back and try other options or photos as often as they like; all of this is free.
   - **Step 3 – Preview & estimate.** Left: a before/after comparison slider. Under it: inpaint mode → "Replaced only the area you painted", img2img → "Whole-photo restyle. Paint the area for a precise swap." Right: feasibility score `/10` colored by value (≥8 green, ≥5 amber, else red) with `feasibility_label` and `rationale`; price range `$low – $high` with "quantity × unit · region"; a small table (Materials low/high, Labour low/high); a "Local accuracy" badge from `price.calibration` ("Adjusted from {samples} completed jobs in your area" if `applied`, otherwise "Learning: {samples}/{needed} local jobs"); if `local.completedJobs > 0`, a muted line "Homeowners nearby paid ${local.avgPaidPrice} on average"; lists Scope and Materials; "Typical timeline: N days"; "Contractor will confirm: …" from `verify_on_site`.
   - **Step 4 – Send a free request.** Name and email inputs. When the email is filled, call `api.quoteFee(email)` and show a fee card: "Quote fee if you go ahead: ${fee}" plus, when `discountPct > 0`, "{discountPct}% loyalty discount" and always "Next time: ${nextFee}". Clear copy: "Sending a request is free. You pay the repair price + quote fee only after the company finalizes your contract." Button **Send free request** → `api.sendRequest({...})` with `company` set when on `/c/:slug`. On success, link to `/request/{id}`.

5. `/request/:id` Homeowner request status (poll `api.getJob(id)` every 10 s):
   - `requested`: "Sent to {company.name}. They will review your pictured plan and send a contract."
   - `contract_sent`: a contract card with company, note, and a breakdown: Repair price, Quote fee (with "−{discountPct}% loyalty" if any), **Total**. Button **Accept & pay ${total}** → `api.payContract(id)`. Label: "Demo mode: no card is charged."
   - `paid`: success card "Paid. {company} will schedule your repair.", the receipt (repair, quote fee, total), and "Your next quote fee: ${nextQuoteFee.fee}".

6. `/dashboard/:slug` Company dashboard (also `/dashboard` for all jobs):
   - Header with the company name and its customer link `/c/{slug}` + Copy button.
   - 6 stat cards from `api.listJobs(slug).stats`: Requests, Contracts sent, Paid jobs, Repair revenue (`$repairRevenue`), Your payout (`$companyPayout`), Estimate vs contract (`avgDeltaPct` with + sign, or "–").
   - Refresh button; poll every 10 s.
   - Job cards, newest first: before/after thumbnails, `#id · item_label → option.name`, region badge, customer name and email, date, feasibility `x/10`, estimate range, timeline, rationale, scope bullets, status badge (requested = grey "New request", contract_sent = blue "Contract sent", paid = green "Paid").
   - If `requested`: form with Repair price (prefilled with the estimate midpoint) and Note, plus a live line "Homeowner pays ${repair + quoteFeePreview.fee} (incl. ${quoteFeePreview.fee} quote fee)". Button **Finalize contract** → `api.finalizeContract(id, repairPrice, note)`, then refresh.
   - If `contract_sent`: "Waiting for the homeowner to pay ${contract.total}".
   - If `paid`: green box "Paid ${billing.total} · Your payout ${billing.companyPayout} · SnapQuote commission ${billing.platformCommission}".
   - Empty state: "No requests yet. Share your link /c/{slug} with customers."

7. `/insights` Market insights (link it from the dashboard header). Built only from finalized, paid jobs, stored anonymously (no names, emails or photos). Data from `api.insights()`, refresh every 15 s:
   - Stat cards from `totals`: Requests, Contracts, Paid jobs, Conversion %, Learning records.
   - "Estimate accuracy by area": table of `calibration` (item type, region, paid jobs, correction shown as +x% / −x%, "Active" badge when `active`, else "Learning (samples/minSamples)"). Caption: "Every paid job teaches SnapQuote the real local price. After {minSamples} jobs, new estimates in that area adjust automatically."
   - "What homeowners buy": horizontal bar chart (recharts) of `options` by `completed`, labelled "{item_type} · {option}", tooltip with average paid price.
   - Empty state: "No completed jobs yet."

## Behaviour

- Show API errors in a toast with the error message.
- Disable buttons and show spinners while requests run.
- Format money with `toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })`.
- If `api.config().ai` is false, show a banner: "Backend AI binding missing."
