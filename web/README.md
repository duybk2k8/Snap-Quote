# SnapQuote web (HTML + CSS + a little JavaScript)

A plain static website: no framework, no build step. Open any `.html` file to see the page, `css/style.css` for every style, and `js/` for the small scripts that talk to the backend.

```
web/
├── index.html        Landing page
├── quote.html        Homeowner quote flow (also served at /c/<company>)
├── request.html      Homeowner tracks a request and pays (/request?id=...)
├── companies.html    Savings calculator + company sign-up
├── dashboard.html    Company dashboard (/dashboard?company=<slug>)
├── insights.html     What SnapQuote learned from paid jobs
├── css/style.css     One stylesheet, sections numbered at the top
├── js/
│   ├── api.js          Every backend call (change API_BASE here)
│   ├── common.js       Helpers: $(), money(), toast(), setBusy()
│   ├── image-tools.js  512x512 photo crop + "paint the part to replace"
│   └── quote.js, request.js, companies.js, dashboard.js, insights.js  One script per page
└── vercel.json       Clean URLs + /c/<slug>, /dashboard/<slug>, /request/<id> routes
```

## Run it on your computer

Pages use paths like `/css/style.css`, so open them through a small local server, not by double-clicking:

```bash
cd web
npx serve .          # or: python -m http.server 3000
```

Then open the address it prints. The site talks to the live backend set in `js/api.js`.

## Deploy to Vercel

1. Go to vercel.com, sign in with GitHub, click **Add New → Project** and import `duybk2k8/Snap-Quote`.
2. Set **Root Directory** to `web`.
3. **Framework Preset:** Other. Leave Build Command and Output Directory empty.
4. Click **Deploy**. Every later `git push` redeploys automatically.

After the first deploy, set `ALLOWED_ORIGIN` in both `wrangler.toml` files to your Vercel URL (for example `https://snap-quote.vercel.app`) and push, so only your site can call the API.

## Demo path

1. `/companies` → create a company → copy its link.
2. Open the link (`/c/<slug>`) → upload a photo → Analyze → Visualize & estimate → enter an email → Send free request.
3. Dashboard → enter a repair price → Finalize contract.
4. Track my request → Accept & pay. The next quote fee drops 10%.
5. `/insights` shows the learning data once there are paid jobs.
