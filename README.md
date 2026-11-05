# Ledger: daily expenses

A private, fast expense tracker for everyday spending in rupees. Log what you spend in a few seconds, see where the money goes, track money you receive, and share clean reports. It works as a website, as a home-screen app, and as an Android app that keeps your data in a real file on your phone.

![Themes](docs/themes.jpg)

## Features

- **Quick logging**: amount, note, category, how you paid, and a date (today, yesterday or any day). Voice entry is supported on browsers that offer it.
- **Edit and delete safely**: tap an entry to edit it; deleting always asks first.
- **Money received**: record income and see your balance for any month.
- **Metro card**: Virtual or Physical card, top-up or fare. Top-ups count as spending; fares are listed but not double-counted.
- **Export and share any period** (day, week, month, all time or a custom range) as **Image, PDF report, JSON, CSV or Text**.
- **PDF analysis report**: totals, category breakdown, a chart over time, biggest expenses and every transaction.
- **Scan old notes**: photograph handwritten expense pages and import them (OCR, needs internet).
- **App lock**: fingerprint / face unlock, PIN or pattern.
- **Six themes**, chosen in the settings sheet (the sliders icon): Classic Paper, Midnight Gold, Emerald Luxe, Royal Sapphire, Rose Noir, Ivory & Gold.
- **Works offline** once opened, and installs like an app.
- **Backups**: one tap to download everything as JSON; import skips anything already present, so restoring twice is safe.

## Where your data is stored

Ledger has no server and no account. Nothing leaves your device unless you export or share it.

| How you run it | Where the data lives |
| --- | --- |
| **Android app (APK)** | A real file on the phone: `Ledger/ledger-data.json` in the app's folder, plus a previous-version spare copy. Written on every change. |
| **Website / home-screen app** | The browser's IndexedDB database, requested as *persistent* storage so it isn't cleared when space is low. Not the page's `localStorage`. |

A website cannot write files to a phone by itself (that is a browser rule, not something this app can change). If you want a real file on the device, use the Android app. Either way, download a backup now and then; the app reminds you weekly.

Data from earlier versions that lived in browser `localStorage` is moved into the new storage automatically the first time you open the app, then removed from `localStorage`.

> Uninstalling the Android app removes its folder. Download a backup first if you plan to uninstall.

All storage code is in [`www/storage.js`](www/storage.js).

## Get it running

### Option A: Netlify (drag and drop, 2 minutes)

1. Go to <https://app.netlify.com/drop>.
2. Drag the **`www`** folder onto the page.
3. Open the link on your phone and use *Add to Home screen* / *Install app*.

To update later, open the same site on Netlify → **Deploys** → drag the `www` folder again. A new drop creates a new address with empty data.

### Option B: GitHub Pages (automatic)

1. Push this repository to GitHub.
2. **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Every push to `main` publishes `www/` (workflow: `.github/workflows/pages.yml`). The address is `https://<your-user>.github.io/<repo>/`.

### Option C: Android app (APK)

1. Push this repository to GitHub.
2. Open the **Actions** tab → **Build Android APK** → **Run workflow**.
3. When it finishes, download **Ledger-apk** from the run page, unzip, and install `Ledger.apk` on your phone (allow "install unknown apps" when asked).

Pushing a tag such as `v1.0.0` also attaches `Ledger.apk` to a GitHub Release. This builds a debug-signed APK, fine for personal use. For the Play Store you would add your own signing key.

### Run locally

```bash
npm run serve        # http://localhost:8080
```

## Project layout

```
www/                  the whole app (what Netlify / Pages / the APK serve)
  index.html          app UI and logic
  storage.js          on-device storage (file in the APK, IndexedDB on the web) + file saving in the APK
  themes.css/.js      the six themes
  boot.js             loads data, applies theme and lock, then starts the app
  sw.js               offline support
  manifest.json       install metadata and icons
  pdf-lib.min.js      PDF generation (bundled, so reports work offline)
capacitor.config.json Android wrapper settings
.github/workflows/    Pages deploy, APK build, syntax check
docs/                 screenshots
```

## Importing data

**Export tab → Import entries** accepts a Ledger JSON file: either a backup, an export of one period, or a hand-made file shaped like

```json
{ "entries": [ { "date": "2026-10-27", "amount": 80, "note": "Eggs", "category": "food", "payment": "cash" } ],
  "income":  [ { "date": "2026-10-01", "amount": 5000, "note": "Allowance", "type": "other" } ] }
```

Categories: `food, transport, metro, shopping, bills, health, fun, other`. Payments: `upi, cash, debit, credit, other`.

## Notes

- Fonts and the OCR engine load from public CDNs; everything else works offline.
- The PDF uses a standard font, so ₹ prints as "Rs." and non-Latin text shows as "?".
- The app lock keeps casual snoopers out; it does not encrypt the stored data.

## License

MIT. See [LICENSE](LICENSE).
