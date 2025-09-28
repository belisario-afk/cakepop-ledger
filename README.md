# SmallBatch  
_Sales • Costs • Ingredients_

SmallBatch is a privacy‑first, offline‑capable ledger for small food businesses:

- Products, Ingredients, Recipes (ingredient-level costing overrides base unit cost)
- Sales & Discounts, Expenses
- Automatic COGS + Revenue, Gross, Net, Margin, AOV metrics
- Encrypted export/import (AES-GCM, PBKDF2)
- GitHub Gist backup (manual or interval)
- Google Sign-In (local namespace separation only)
- PWA offline support
- Theme personalization: colors, glass, ambient gradient, typography, presets, pattern background
- Luxury visual polish: subtle embossed card borders, parallax depth (reduced motion aware)

## Data Privacy
All operational data lives in LocalStorage (per Google account `sub` or guest). No external sync unless you enable gist backup or manually export.

## Encryption
Encrypted export: AES-GCM with PBKDF2 (150k iterations). Password is never stored. Lose password = unrecoverable export.

## Gist Backup
Use a GitHub Personal Access Token with only the `gist` scope. Stored locally (user risk if machine compromised).

## Theming & Appearance
- Presets: default, gold, noir, rose, emerald
- Pattern generator (seed-based geometric)
- Ambient animation (slow ~6 min gradient shift)
- Tabular numerals for stable metric alignment

## Build / Deploy
Pure static. Place files in a GitHub Pages repo root (e.g. `cakepop-ledger`). Ensure `service-worker.js` and `manifest.webmanifest` at root.

## Google Sign-In
Create OAuth Web Client ID, add your GitHub Pages origin, paste client ID in `ui.js` (or define `window.SMALLBATCH_GOOGLE_CLIENT_ID`).

## Commands (optional icon generation)
```bash
bash scripts/generate-icons.sh
```

## Roadmap Ideas
- Inventory depletion & reorder alerts
- Pricing sandbox / forecasting
- Weekly comparison & anomaly detection
- Cloud sync (FireStore / Supabase)
- Plugin/report architecture

## License
MIT (see LICENSE).

Enjoy SmallBatch!