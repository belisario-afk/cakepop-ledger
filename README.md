# SmallBatch  
_Sales • Costs • Ingredients_

SmallBatch is a privacy-first, offline-capable ledger for small food businesses to track:
- Products / Recipes / Ingredients
- Sales & Discounts
- Expenses
- Automatic COGS (with recipe costing)
- Profit metrics (Revenue, COGS, Gross, Net, Margin, AOV)
- Encrypted export/import (AES-GCM)
- GitHub Gist backup (optional)
- Google Sign-In (per-user isolated local data)
- PWA offline support
- Mobile-friendly & accessible (larger touch targets, high-contrast mode)

## Rebrand / Migration (from Cake Pop Ledger)
If you previously used "Cake Pop Ledger," your data will automatically migrate on first load (it searches legacy keys). Nothing required.

## Tech Stack
Pure static frontend (HTML/CSS/Vanilla JS). Data stored locally (LocalStorage per user namespace). Optional gist backup. No build system required.

## Features
- Products with base cost & price
- Ingredient catalog (unit + cost per unit)
- Recipes linking ingredients to products; recipe cost overrides base unit cost
- Sales logging (quantity, discount, notes)
- Expense logging (categories)
- Metrics dashboard + 30-day trend chart
- Top products
- Filters by date
- Export plain JSON + encrypted JSON + sales CSV
- Google Sign-In (multi-user separation)
- GitHub Gist backup (manual/auto)
- Dark mode + High Contrast toggle

## Folder Structure
```
/index.html
/assets
  /css/styles.css
  /js/*.js
  /icons/icon-source.svg
/backup
manifest.webmanifest
service-worker.js
offline.html
README.md
LICENSE
```

## Setup (GitHub Pages)
1. Create repo (e.g., smallbatch).
2. Commit these files to `main`.
3. Settings → Pages → Deploy from branch (main / root).
4. Open the published URL. Visit once online so it caches offline.

## Google Sign-In
1. Create OAuth Web Client ID at Google Cloud Console.
2. Add origin: `https://YOUR_USERNAME.github.io`
3. Edit `auth.js` or set `window.SMALLBATCH_GOOGLE_CLIENT_ID` in `index.html` (see inline comment).
4. Reload site; sign in; each account has isolated dataset.

## GitHub Gist Backup
Create a GH personal access token (classic) with ONLY `gist` scope:
- Enter token + optional gist ID in Data → Gist Backup section.
- Set auto backup interval (minutes) > 0 to enable periodic uploads.
- Manual backup / restore buttons included.
WARNING: Token stored in LocalStorage (user risk).

## Encryption
Encrypted export uses PBKDF2 (150k iterations) + AES-GCM. If you lose the password there is no recovery.

## Accessibility & Mobile
- Minimum 44px touch targets
- Larger base font and increased line-height
- High Contrast mode for users needing extra clarity
- Distinct focus outlines
- Keyboard navigable

## Privacy
All operational data is local unless you explicitly:
- Export to file
- Sync via gist

No remote analytics.

## Roadmap Ideas
- Ingredient stock depletion by sales volume
- Batch scaling & yield planner
- Firestore / Supabase sync (token verification)
- Multi-language
- Dashboard drilldowns (per product profit timeline)

## License
MIT (see LICENSE)

Enjoy using SmallBatch!