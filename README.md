# Cake Pop Ledger

A lightweight, privacy-first, offline-capable sales & expense tracker for a small cake pop (or similar) business. 100% static (no backend) and works on GitHub Pages. Data is stored locally in the browser (LocalStorage) with export/import tools for backup.

## Features

- Products / flavors with cost & price
- Sales logging (qty, discount, notes)
- Expenses logging with categories
- Automatic metrics: Revenue, COGS, Gross, Net, Margin, AOV
- Top flavors + 30-day revenue line chart
- Date filtering
- Export JSON & CSV
- Import JSON (restore or migrate)
- Dark / Light mode
- PWA (Install + offline support)
- Offline fallback page
- Manual backups (commit exported JSON to /backup)

## Quick Start

1. Clone repo
2. Enable GitHub Pages (Settings → Pages → Branch = main / root).
3. Visit the published URL.
4. Add Products → Log Sales / Expenses → Use Dashboard.
5. Export JSON regularly (store in `/backup/` or download locally).

## Backup Strategy

- Click Export JSON in Data view.
- Optionally commit exported files in `backup/`.
- Keep dated snapshots (e.g. `backup/2025-09-28-ledger.json`).

## Local Development

Open `index.html` directly OR serve with a static server:
```
python -m http.server 8080
```
(Needed if you want clean service worker behavior.)

## Icons

Edit `assets/icons/icon-source.svg` then run:
```
bash scripts/generate-icons.sh
```
(Requires ImageMagick.) This updates `icon-192.png` & `icon-512.png`.

## Security / Privacy Notes

- All data stays on the client until you export it.
- No analytics, no external calls.
- Clearing browser storage erases your data. Export regularly.
- To sync across devices later, you can:
  - Add a backend (Supabase / Firebase).
  - Push JSON to a private GitHub Gist (requires OAuth flow or PAT).
  - Replace LocalStorage with IndexedDB for larger datasets (optional).

## Roadmap Ideas (Optional Enhancements)

- Ingredient-level inventory
- Batch production planning
- Tax estimation module
- Multi-device encrypted sync
- Role-based multi-user mode

## License

MIT (see [LICENSE](LICENSE)).

## Contributing

PRs welcome for small improvements or optional features. Keep bundle size small (no large frameworks).

## Offline

An `offline.html` is served if the app shell fails to load while offline. First visit must be online to cache assets.

## Accessibility

- Semantic HTML for tables & forms
- High-contrast dark theme
- Keyboard focus outlines

---

Enjoy your baking business tracking!