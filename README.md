# Solace — Daily Reflections 🤎

A warm, private space to reflect on each day of the year and gain gentle insight.
Solace is a **Progressive Web App (PWA)** — it runs in the browser but installs to your
iPhone Home Screen and feels like a native app, with a full-screen icon and offline writing.

## What it does

- **Today** — write your reflection for the day, choose how it felt, and save it. A fresh prompt greets you daily, and a 🔥 streak counter tracks how many days in a row you've shown up. "On this day" surfaces a past reflection when one exists.
- **Journal** — every entry is stored on its own page, browsable and searchable by date and mood, with a colour-coded month calendar, a mood breakdown, and your streak/entry stats. Your record of showing up.
- **Reflect** — an AI companion that has read *all* of your journal and helps you notice patterns, reframe hard days, and understand yourself with more compassion. It's grounded in what you actually wrote, references specific days, and asks caring questions.

### Also included

- **Passcode lock** — optionally protect your journal with a 4-digit passcode (Settings → Privacy).
- **Backup & restore** — export your whole journal to a file, and import it back on a new device (Settings → Your data). Solace also asks the browser for durable storage so your entries are less likely to be evicted.
- **Bold, theme-aware design** — a vibrant sunset-to-violet palette that adapts to your phone's light or dark mode.

## Your privacy

- Your reflections are stored **only on your device**, in the browser's local storage. Nothing is uploaded to any server by the app itself.
- The **Reflect** companion is powered by [Claude](https://www.anthropic.com/claude). To use it you add your own Claude API key in Settings; the key is stored only on your device and is used solely to send your messages (and your journal, as context) directly to Anthropic so Claude can respond.
- Use **Settings → Export my data** any time to download a JSON backup of your journal.

Solace is a reflective companion — **not** a therapist, medical service, or crisis line. If you're in crisis, contact local emergency services or a crisis line (e.g. call or text **988** in the US).

## Get it on your iPhone

1. **Host the app** so your phone can open it over HTTPS (pick one):
   - **GitHub Pages (free):** in this repo, go to **Settings → Pages**, set the source to your branch (root), and open the published URL on your iPhone.
   - Or any static host (Netlify, Vercel, Cloudflare Pages) — just deploy this folder.
2. Open the URL in **Safari** on your iPhone.
3. Tap the **Share** button → **Add to Home Screen**. Solace now opens full-screen like a real app.

## Connect the AI companion

1. Create a Claude API key at **[console.anthropic.com](https://console.anthropic.com/settings/keys)** (you'll need an Anthropic account; API usage is billed to you, and reflections are short so cost is minimal).
2. In Solace, tap the **⚙︎** gear → paste your key → **Save**.
3. Open **Reflect** and start talking.

The companion uses `claude-opus-4-8` by default; you can change the model in Settings if you prefer another Claude model.

## Run it locally

It's plain static files — no build step.

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

(Journaling works offline; the AI companion needs an internet connection.)

## Project files

| File | Purpose |
|------|---------|
| `index.html` | App shell, layout, and styles |
| `app.js` | All app logic — entries, journal, the Claude-powered companion |
| `sw.js` | Service worker for offline shell caching |
| `manifest.webmanifest` | PWA manifest (Home Screen install, icons, theme) |
| `icons/` | App icons |

Made with care. Be gentle with yourself. 🤎
