# OnlyUsedTesla.ai — YoYo Agent UI (Prototype — Light Brand Theme)

This repo is a **front-end only** (no backend) prototype for the **main YoYo AI agent UI**:
- **One UI** with **Chat + Voice tabs**
- **Tesla product cards** (tagged **Dealer** or **Private**, plus optional **Verified** badge)
- A **seller “cash offer” flow** (intake → dealer offers → accept/decline)
- A **web-search fallback** pattern (answer + **sources**) for questions the agent can’t answer from training data or inventory data

Plus NN/g-inspired chat usability helpers:
- **Tap-to-select paragraphs/bullets** in YoYo’s messages (point-to-select)
- **Edit / shorten / expand / remove** a *single* selected section (compartmentalized edits)
- **Pin a snippet** near the composer to avoid excessive scrolling (apple-picking helper)
- **Show more / show less** for long responses (lightweight “accordion” collapse)

> Not affiliated with Tesla, Inc. “Tesla” is used to describe vehicle inventory only.

---

## Brand theme

This build uses a **lighter** OnlyUsedTesla.ai brand theme:
- **Background:** Cloud Dancer (Pantone Color of the Year 2026) — web approx `#F0EEE9`
- **Primary:** #0D263C (navy)
- **Accent:** #91B3CB (light blue)
- **Warm neutral:** #E5DADA
- **Font:** Montserrat (Google Fonts)
- **Logo/Icon:** `assets/yoyo-icon.png`

> Red (#E54546) is reserved for *error/destructive* states only.


---

## Quick start (local)

### Option A — open directly
Just open `index.html` in your browser.

### Option B — serve locally (recommended for iOS/Safari)
From the repo folder:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

---

## Deploy to GitHub Pages

1. Create a new GitHub repo (e.g. `onlyusedtesla-ui`).
2. Upload these files.
3. In GitHub: **Settings → Pages → Deploy from branch** (root).
4. Your prototype will be live on a `github.io` URL.

---

## App map

- `#/home` — landing CTA (Shop / Cash offer / Advertise)
- `#/agent?flow=shop` — **Shop flow** (Chat + Voice, inventory cards)
- `#/agent?flow=sell` — **Sell flow** (estimate + request offers)
- `#/agent?flow=advertise` — **Advertise flow**
- `#/listing?id=...` — listing detail + actions (test drive, deposit, PAY OUT)
- `#/saved` — saved listings
- `#/offers` — dealer offers list (demo)

---

## Where the “AI” logic lives (replace with backend)

This prototype includes mock logic in `app.js`:

- `yoyoRespond(flow, userText)`  
  Returns a structured response `{ text, chips, cards, actions, sources }`.

- `inventorySearch(queryText)`  
  Searches a small demo `INVENTORY` array.

- `mockWebSearch(query)`  
  Shows the UI pattern: “I searched the web → summary → sources”.

**To productionize:**
- Replace these with calls to your backend (Azure Function / API / Next.js API route).
- Return the same shape so UI rendering stays identical.

---

## Product cards (dealer vs private)

Each listing supports:
- `sellerType: "dealer" | "private"`
- `verifiedDealer: true|false`

UI behavior:
- Dealer / Private tags always show.
- Verified badge shows only when `verifiedDealer` is true.

---

## Voice mode

Voice mode uses the browser’s built-in APIs:
- Speech-to-text: `SpeechRecognition` / `webkitSpeechRecognition`
- Text-to-speech: `speechSynthesis`

If unsupported, the UI shows a simple “not supported” status.

---

## Comps + cash offer: engineering reality (important)

**You *can* build “comps” + “cash offer” features**, but you should avoid scraping sites like CarGurus/Cars.com/Autotrader/Carvana/Edmunds without permission — that often violates terms of service and can break anytime.

Better options:
- Use a **licensed valuation / market data provider** (Black Book, J.D. Power, etc.)
- Use **partner feeds** (inventory CSV/XML/API) from dealers + marketplaces you have agreements with
- Allow the user to **paste links** (or upload screenshots) from Carvana/Edmunds offers as a reference, then you normalize it into your UI
- Use your own marketplace history once you have enough listings + outcomes

This UI already supports:
- “Estimate range”
- “Example comps”
- “Request dealer cash offers”
- “Web search with sources” fallback

---

## Files

- `index.html`
- `styles.css`
- `app.js`

No build step, no dependencies.

---

## Next upgrades (if you want)

- Inventory filters drawer (model, price, miles, seller type)
- Real “selected vehicle context” (agent always answers in context of chosen VIN)
- Dealer profile screen (verification evidence, photos, business license, reviews)
- Chat “citations” in a tighter layout (numbers, expandable sources)
- Auth + saved listings synced to account
- Lead summary export (CRM webhook)
