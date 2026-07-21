# GUTTED — Launch Tracker

A single-file command center for the 4-week validation test behind **GUTTED**. Log your
posts, watch the week-4 gate, and don't blow the $50 phase cap. It runs in the browser
but installs to your iPhone Home Screen as a **Progressive Web App (PWA)** — full-screen
icon, works offline, no login, no server, no external APIs.

Everything lives in your browser's local storage on this one device. Nothing is uploaded
anywhere.

## The five tabs

- **Posts** — log each post (date, platform, format, hook) and update the metrics over time:
  views, saves, shares, comments, new followers. A pre-post **gut check** appears every time
  you add one (no therapeutic claims — nothing *fixes / cures / treats / relieves*, not even
  as a joke; humour in the feeling, not a promise; replied to the last post's comments). Your
  best performer is auto-flagged by **saves + shares** (deliberately not likes). A progress bar
  tracks X of 12 posts against the 4-week target, and a "days since last post" nag turns red
  after 3 days.
- **The Gate** — three gauges against the green-gate criteria: **1 post over 10k views**,
  **200–500 followers**, **50+ waitlist signups**. Type your current follower and waitlist
  totals (update them from Carrd); best-view is pulled from your posts automatically. A verdict
  line reads the data: **GREEN** (all three trending to hit) / **SHARPEN HOOKS** (soft but alive)
  / **FLATLINE** (nothing moving across 12 posts). Set your start date and it counts down the
  days left in the test.
- **Money** — $1,000 total budget with a $50 current-phase cap. Log every expense with a
  category; the phase bar warns as you approach $50 and hard-stops at it. A permanent list of
  **banned spends** (logo, packaging, trademark filing, ads, anything with GUTTED on it) sits
  right there as a reminder.
- **Tasks** — a pre-loaded, phased checklist: **Setup** → **Weekly loop** → **Week 4** →
  **If green** (creator shortlist, manufacturer emails to APM / Lipa / Morlife, pre-sale plan).
  Add, check, and delete your own.
- **Ideas** — quick-capture for content ideas with a format tag, seeded with your existing
  formats so ideas stop living in your head.

Every entry is editable after you save it — tap a hook, task, idea, or expense label and type.
The **Danger zone** on the Ideas tab wipes everything on the device.

## Get it on your iPhone

1. **Host the files** over HTTPS (pick one):
   - **GitHub Pages (free):** repo **Settings → Pages**, set the source to this branch (root),
     then open the published URL on your iPhone.
   - Or any static host (Netlify, Vercel, Cloudflare Pages) — deploy this folder as-is.
2. Open the URL in **Safari**.
3. Tap **Share → Add to Home Screen**. It now opens full-screen like a real app and works offline.

## Run it locally

Plain static files, no build step:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Files

| File | What it is |
|------|------------|
| `index.html` | The entire app — HTML, CSS, and JS in one self-contained file |
| `manifest.webmanifest` | PWA metadata (name, icons, theme colors) |
| `sw.js` | Service worker for offline caching |
| `icons/` | Home Screen icons |

## A note on the copy

GUTTED is a brand, not a medical service. The tracker never lets a post make a therapeutic
claim, and it says nothing about anyone's health. It just counts posts, dollars, and days.
