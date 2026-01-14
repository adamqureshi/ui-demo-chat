/* OnlyUsedTesla.ai — YoYo Agent UI (Prototype)
   - Single-page app (hash router)
   - Chat + Voice tab
   - Product cards tagged Dealer / Private
   - Simple sell ("cash offer") flow with dealer offers
   - "When I don't know" fallback with a mock web-search answer + sources

   NOTE: This is a FRONT-END ONLY prototype.
         Wire to your backend (Azure, etc.) by replacing the mock functions:
         - yoyoRespond()
         - mockWebSearch()
         - inventorySearch()
*/

const BRAND = { agentName: "YoYo", icon: "./assets/yoyo-icon.png" };

const $app = document.getElementById("app");
const $toast = document.getElementById("toast");

/* ---------------------------
   Mock inventory + dealers
----------------------------*/
const INVENTORY = [
  {
    id: "m3p-2022-a1",
    year: 2022,
    model: "Model 3",
    trim: "Performance",
    price: 38900,
    mileage: 26840,
    location: "Austin, TX",
    sellerType: "dealer",
    sellerName: "Lone Star EV",
    verifiedDealer: true,
    exterior: "Pearl White",
    interior: "Black",
    rangeEst: "315 mi",
    autopilot: "Enhanced Autopilot",
    fsd: "Not included",
    warranty: "Basic warranty until 2026",
    notes: "Clean title. 20\" Überturbine wheels. Heated seats."
  },
  {
    id: "my-2021-b2",
    year: 2021,
    model: "Model Y",
    trim: "Long Range",
    price: 34950,
    mileage: 41210,
    location: "Phoenix, AZ",
    sellerType: "private",
    sellerName: "Private seller",
    verifiedDealer: false,
    exterior: "Midnight Silver",
    interior: "White",
    rangeEst: "326 mi",
    autopilot: "Autopilot",
    fsd: "Included (verify in app)",
    warranty: "Battery/Drive unit until 2029",
    notes: "One-owner. Garage kept. Recent tires."
  },
  {
    id: "ms-2019-c3",
    year: 2019,
    model: "Model S",
    trim: "Long Range",
    price: 42900,
    mileage: 55800,
    location: "San Diego, CA",
    sellerType: "dealer",
    sellerName: "Pacific Auto Gallery",
    verifiedDealer: false,
    exterior: "Deep Blue",
    interior: "Black",
    rangeEst: "370 mi",
    autopilot: "Autopilot",
    fsd: "Not included",
    warranty: "Battery/Drive unit until 2027",
    notes: "Premium interior. MCU2 upgrade."
  },
  {
    id: "m3-2020-d4",
    year: 2020,
    model: "Model 3",
    trim: "Standard Range Plus",
    price: 23900,
    mileage: 60200,
    location: "Orlando, FL",
    sellerType: "private",
    sellerName: "Private seller",
    verifiedDealer: false,
    exterior: "Red Multi-Coat",
    interior: "Black",
    rangeEst: "250 mi",
    autopilot: "Autopilot",
    fsd: "Not included",
    warranty: "Expired (basic)",
    notes: "Minor curb rash on one wheel."
  },
  {
    id: "mx-2018-e5",
    year: 2018,
    model: "Model X",
    trim: "100D",
    price: 44900,
    mileage: 73100,
    location: "Chicago, IL",
    sellerType: "dealer",
    sellerName: "Windy City Motors",
    verifiedDealer: true,
    exterior: "Solid Black",
    interior: "Cream",
    rangeEst: "295 mi",
    autopilot: "Enhanced Autopilot",
    fsd: "Not included",
    warranty: "Battery/Drive unit until 2026",
    notes: "6-seat config. Falcon doors inspected."
  }
];

const MOCK_DEALER_OFFERS = [
  {
    id: "offer-1",
    dealerName: "Lone Star EV",
    verified: true,
    location: "Austin, TX",
    offer: 31200,
    expiresDays: 3,
    terms: "Valid with clean title + matching condition. Final offer after photo review.",
    nextSteps: ["Upload photos", "Schedule pickup or drop-off", "Get paid in 24–48h (demo)"]
  },
  {
    id: "offer-2",
    dealerName: "Pacific Auto Gallery",
    verified: false,
    location: "San Diego, CA",
    offer: 30500,
    expiresDays: 2,
    terms: "Subject to inspection. Odometer + options must match.",
    nextSteps: ["Share VIN", "Send dash warning photo", "Pick a handoff time"]
  },
  {
    id: "offer-3",
    dealerName: "Windy City Motors",
    verified: true,
    location: "Chicago, IL",
    offer: 29800,
    expiresDays: 4,
    terms: "Transport included within 200 miles. Final offer after quick video call.",
    nextSteps: ["Confirm lien status", "Video walkaround", "Sign e-docs"]
  }
];

/* ---------------------------
   App state
----------------------------*/
const state = {
  route: { name: "home", params: {} },
  activeTab: "chat", // chat | voice
  activeFlow: "shop", // shop | sell | advertise
  selectedListingId: null,
  saved: new Set(),
  chatByFlow: {
    shop: [],
    sell: [],
    advertise: []
  },
  sellIntake: {
    year: "",
    model: "",
    trim: "",
    mileage: "",
    zip: "",
    condition: "",
    notes: ""
  },
  offers: [],
  voice: {
    supported: false,
    listening: false,
    transcript: "",
    speakResponses: true,
    autoSend: true
  },

  // NN/g-inspired usability helpers (accordion editing + apple picking)
  // - selection lets users point-to-select a specific paragraph/bullet in an AI response
  // - pinnedContext keeps a chosen snippet visible near the composer to avoid scrolling
  selection: null,      // { msgId, blockIndex }
  pinnedContext: null,  // { msgId, blockIndex, text }
  modal: null           // { type: "editBlock", msgId, blockIndex }
};

/* ---------------------------
   Router
----------------------------*/
function parseHash() {
  const raw = (location.hash || "#/home").slice(1); // "/home?x=1"
  const [path, qs] = raw.split("?");
  const name = (path || "/home").replace("/", "") || "home";
  const params = Object.fromEntries(new URLSearchParams(qs || ""));
  return { name, params };
}

function navTo(hash) {
  if (!hash.startsWith("#/")) hash = "#/" + hash.replace(/^#?\/?/, "");
  location.hash = hash;
}

window.addEventListener("hashchange", () => {
  state.route = parseHash();
  // Keep flow in sync if present in URL
  if (state.route.name === "agent" && state.route.params.flow) {
    state.activeFlow = safeFlow(state.route.params.flow);
  }
  render();
});

function safeFlow(v) {
  return (v === "shop" || v === "sell" || v === "advertise") ? v : "shop";
}

/* ---------------------------
   Utilities
----------------------------*/
function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === "class") node.className = v;
    else if (k === "dataset") Object.assign(node.dataset, v);
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === "html") node.innerHTML = v;
    else if (v === false || v == null) continue;
    else node.setAttribute(k, v);
  }
  (Array.isArray(children) ? children : [children]).forEach((c) => {
    if (c == null) return;
    node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  });
  return node;
}

function money(n) {
  const x = Number(n || 0);
  return x.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function num(n) {
  const x = Number(n || 0);
  return x.toLocaleString();
}

function nowHHMM() {
  const d = new Date();
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

let _toastTimer = null;
function toast(msg) {
  $toast.textContent = msg;
  $toast.classList.add("show");
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => $toast.classList.remove("show"), 1700);
}

function icon(name) {
  const icons = {
    back: `<svg viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    home: `<svg viewBox="0 0 24 24" fill="none"><path d="M4 10.5L12 4l8 6.5V20a1.5 1.5 0 0 1-1.5 1.5H5.5A1.5 1.5 0 0 1 4 20v-9.5z" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><path d="M9.5 21v-7h5v7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`,
    reset: `<svg viewBox="0 0 24 24" fill="none"><path d="M3 12a9 9 0 0 1 15.3-6.36" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M18 4v4h-4" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M21 12a9 9 0 0 1-15.3 6.36" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M6 20v-4h4" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    // Mobile-friendly “send” (arrow up)
    send: `<svg viewBox="0 0 24 24" fill="none"><path d="M12 19V5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M5 12l7-7 7 7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    mic: `<svg viewBox="0 0 24 24" fill="none"><path d="M12 14a3 3 0 0 0 3-3V7a3 3 0 0 0-6 0v4a3 3 0 0 0 3 3z" stroke="currentColor" stroke-width="2.2"/><path d="M19 11a7 7 0 0 1-14 0" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M12 18v3" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M8 21h8" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`,
    search: `<svg viewBox="0 0 24 24" fill="none"><path d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15z" stroke="currentColor" stroke-width="2.2"/><path d="M21 21l-4.2-4.2" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`,
    bookmark: `<svg viewBox="0 0 24 24" fill="none"><path d="M6 4.5A2.5 2.5 0 0 1 8.5 2h7A2.5 2.5 0 0 1 18 4.5V22l-6-4-6 4V4.5z" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/></svg>`,
    tag: `<svg viewBox="0 0 24 24" fill="none"><path d="M20.59 13.41L11 3.83V3h-7v7h.83l9.59 9.59a2 2 0 0 0 2.83 0l3.34-3.34a2 2 0 0 0 0-2.83z" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><path d="M7.5 7.5h.01" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
    external: `<svg viewBox="0 0 24 24" fill="none"><path d="M14 3h7v7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 14L21 3" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M21 14v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`
  };
  const wrap = el("span", { html: icons[name] || "" });
  return wrap.firstChild;
}

function scrollChatToBottom() {
  const list = document.querySelector("[data-msglist]");
  if (!list) return;
  list.scrollIntoView({ block: "end" });
  // Also scroll the page a bit to keep composer visible on iOS
  window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
}

function activeChat() {
  return state.chatByFlow[state.activeFlow];
}

function pushMsg(msg) {
  const chat = activeChat();
  chat.push({ id: cryptoId(), time: nowHHMM(), ...msg });
}

function cryptoId() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16).slice(2);
}

/* ---------------------------
   NN/g-inspired chat helpers
   - Accordion editing: built-in collapse/expand for long responses (no re-prompt needed)
   - Apple picking: point-to-select + pin/edit a specific paragraph/bullet
----------------------------*/
function textToBlocks(text) {
  const raw = String(text || "").replace(/\r\n/g, "\n").trimEnd();
  if (!raw) return [];
  const lines = raw.split("\n");

  const blocks = [];
  let buf = [];

  const flush = () => {
    if (!buf.length) return;
    const t = buf.join("\n").trim();
    if (t) blocks.push({ kind: "p", text: t });
    buf = [];
  };

  for (const line of lines) {
    const l = String(line ?? "").replace(/\s+$/g, "");
    if (!l.trim()) {
      flush();
      continue;
    }

    // Treat common list markers as their own selectable blocks.
    if (/^\s*(•|-|\*)\s+/.test(l)) {
      flush();
      blocks.push({ kind: "bullet", text: l.trim() });
      continue;
    }

    buf.push(l);
  }
  flush();
  return blocks;
}

function ensureBlocks(msg) {
  if (!msg || msg.role !== "assistant" || msg.typing) return [];
  if (!msg.blocks && msg.text) msg.blocks = textToBlocks(msg.text);
  if (msg.collapsed == null) msg.collapsed = (msg.blocks && msg.blocks.length > 5);
  return msg.blocks || [];
}

function findMsgById(msgId) {
  const chat = activeChat();
  return chat.find((m) => m && m.id === msgId) || null;
}

function setSelection(msgId, blockIndex) {
  if (!msgId && msgId !== 0) {
    state.selection = null;
    render();
    return;
  }
  // Toggle off when tapping the same block again.
  if (state.selection && state.selection.msgId === msgId && state.selection.blockIndex === blockIndex) {
    state.selection = null;
  } else {
    state.selection = { msgId, blockIndex };
  }
  render();
}

function selectedBlock() {
  const s = state.selection;
  if (!s) return null;
  const m = findMsgById(s.msgId);
  if (!m) return null;
  const blocks = ensureBlocks(m);
  const b = blocks[s.blockIndex];
  if (!b) return null;
  return { msg: m, block: b, index: s.blockIndex };
}

function shortenText(t) {
  const s = String(t || "").replace(/\s+/g, " ").trim();
  if (s.length <= 120) return s;
  return (s.slice(0, 120).replace(/[\s,;:]+$/g, "") + "…");
}

function expandText(t) {
  const s = String(t || "").trim();
  const addon = " (More detail: In production, YoYo would expand only this section with specs, checks, and next steps.)";
  if (!s) return s;
  if (s.includes("More detail:")) return s; // don't spam
  return s + addon;
}

function applyBlockEdit(mode) {
  const sel = selectedBlock();
  if (!sel) return;

  const { msg, index } = sel;

  if (mode === "remove") {
    msg.blocks.splice(index, 1);
    state.selection = null;
    toast("Removed section");
    render();
    return;
  }

  const cur = msg.blocks[index]?.text || "";

  if (mode === "shorten") {
    msg.blocks[index].text = shortenText(cur);
    toast("Shortened");
    render();
    return;
  }

  if (mode === "expand") {
    msg.blocks[index].text = expandText(cur);
    toast("Expanded");
    render();
    return;
  }

  if (mode === "pin") {
    state.pinnedContext = { msgId: msg.id, blockIndex: index, text: cur };
    toast("Pinned near composer");
    render();
    return;
  }

  if (mode === "edit") {
    state.modal = { type: "editBlock", msgId: msg.id, blockIndex: index };
    render();
    return;
  }
}

/* ---------------------------
   App init
----------------------------*/
function initVoiceSupport() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  state.voice.supported = !!SR;
}
initVoiceSupport();

function seedIfEmpty() {
  // Seed shop chat
  if (state.chatByFlow.shop.length === 0) {
    pushMsg({
      role: "assistant",
      text:
`Hi — I’m YoYo 🤖

Tell me what you want (model, budget, location, dealer vs private), and I’ll show matching Teslas.

Try: “Model Y under $35k near Phoenix”`,
      chips: ["Model 3 under $25k", "Model Y under $35k", "Private sellers near me", "Compare Model 3 vs Y"]
    });
  }

  // Seed sell chat
  if (state.chatByFlow.sell.length === 0) {
    pushMsg({
      role: "assistant",
      text:
`Selling your Tesla? I can:
• estimate an asking price (comps + market range)
• request cash offers from verified dealers
• summarize the best offer + next steps

Start with: year + model + mileage + ZIP.`,
      chips: ["2021 Model Y • 42k miles • 85001", "Enter VIN instead", "How do you verify dealers?", "What info do you need?"]
    });
  }

  // Seed advertise chat
  if (state.chatByFlow.advertise.length === 0) {
    pushMsg({
      role: "assistant",
      text:
`Want to advertise your Tesla here?

I’ll help you build a clean listing (photos, options, honest notes) and then publish it (demo).`,
      chips: ["List my Model 3", "What photos should I take?", "How much does it cost?", "Dealer vs private rules"]
    });
  }
}
seedIfEmpty();

/* ---------------------------
   Mock “AI” logic (replace with backend)
----------------------------*/
function inventorySearch(queryText) {
  const q = (queryText || "").toLowerCase();

  let model = null;
  if (q.includes("model 3") || q.includes("m3")) model = "Model 3";
  if (q.includes("model y") || q.includes("my")) model = "Model Y";
  if (q.includes("model s") || q.includes("ms")) model = "Model S";
  if (q.includes("model x") || q.includes("mx")) model = "Model X";

  let maxPrice = null;
  const priceMatch = q.match(/under\s*\$?\s*([0-9]{2,3})\s*k/);
  if (priceMatch) maxPrice = Number(priceMatch[1]) * 1000;

  const priceMatch2 = q.match(/\$?\s*([0-9]{2,3}),?([0-9]{3})/);
  if (!maxPrice && priceMatch2) maxPrice = Number(priceMatch2[1] + priceMatch2[2]);

  let sellerType = null;
  if (q.includes("private")) sellerType = "private";
  if (q.includes("dealer")) sellerType = "dealer";

  // Very light "near me" / city matching
  const cityTokens = ["austin", "phoenix", "san diego", "orlando", "chicago"];
  const city = cityTokens.find((c) => q.includes(c)) || null;

  let results = INVENTORY.slice();

  if (model) results = results.filter((x) => x.model === model);
  if (maxPrice != null) results = results.filter((x) => x.price <= maxPrice);
  if (sellerType) results = results.filter((x) => x.sellerType === sellerType);
  if (city) results = results.filter((x) => x.location.toLowerCase().includes(city));

  // Sort cheapest first by default
  results.sort((a, b) => a.price - b.price);

  return results.slice(0, 4);
}

function yoyoRespond(flow, userText) {
  const text = (userText || "").trim();
  const low = text.toLowerCase();

  // Global intents
  if (low.includes("start over") || low === "reset") {
    return {
      text: "Done. What do you want to do next?",
      chips: ["Shop used Teslas", "Get a cash offer", "Advertise my Tesla"]
    };
  }

  if (flow === "shop") {
    // If user asks about selected listing
    if (state.selectedListingId && (low.includes("this") || low.includes("that") || low.includes("selected") || low.includes("car"))) {
      const v = INVENTORY.find(x => x.id === state.selectedListingId);
      if (v) {
        return {
          text:
`Here’s what I know about the selected Tesla:

• ${v.year} ${v.model} ${v.trim}
• ${money(v.price)} • ${num(v.mileage)} mi • ${v.location}
• Autopilot: ${v.autopilot}
• FSD: ${v.fsd}
• Range (EPA est.): ${v.rangeEst}
• Notes: ${v.notes}

Ask me anything about warranty, features, charging, or what to verify before you buy.`,
          chips: ["What should I verify before buying?", "Is FSD actually included?", "How to check battery health?", "Can you compare to another listing?"]
        };
      }
    }

    // Search intent
    const wantsSearch = /(model\s[3ysx])|model\s(3|y|s|x)|under|\$|budget|near|private|dealer|show me|find/i.test(text);
    if (wantsSearch) {
      const hits = inventorySearch(text);
      if (hits.length) {
        const modelHint = hits[0].model;
        return {
          text:
`I found ${hits.length} matching options. Tap a card to view details, save, or ask about it.

Want to tighten it up (budget, mileage, seller type)?`,
          chips: [`Only ${modelHint} under $30k`, "Only verified dealers", "Only private sellers", "Under 40k miles"],
          cards: hits.map(x => ({ kind: "vehicle", id: x.id }))
        };
      }
      return {
        text:
`I don’t see a match in the demo inventory. In production, I’d search your full feed.

Try loosening one filter (budget, model, seller type), or tell me your ZIP and max price.`,
        chips: ["Model 3 under $30k", "Model Y under $40k", "Show dealer listings", "Show private sellers"]
      };
    }

    // Known Q&A
    if (low.includes("compare") && (low.includes("3") || low.includes("y"))) {
      return {
        text:
`Quick comparison (general):

• Model 3: lower price, more efficient, sportier feel.
• Model Y: more cargo space + higher seating, easier for families, usually a bit more expensive.

If you tell me your budget + use-case (commute, kids, road trips), I’ll recommend a short list.`,
        chips: ["Commute + budget friendly", "Family + cargo space", "Performance / fun", "Snow + AWD"]
      };
    }

    // Unknown / web-search fallback
    if (low.includes("recall") || low.includes("fsd transfer") || low.includes("federal credit") || low.includes("supercharger pricing")) {
      return {
        text:
`I *might* be wrong on that without checking current sources.

If you want, I can do a quick web search and show you the sources I used.`,
        actions: [{ type: "websearch", label: "Search the web (with sources)" }],
        chips: ["Search the web", "Ask the dealer instead", "What do I need to verify on the listing?"]
      };
    }

    return {
      text:
`Got it. Tell me what you’re shopping for (model + budget + ZIP), or tap a chip to start.`,
      chips: ["Model 3 under $25k", "Model Y under $35k", "Dealer listings only", "Private sellers only"]
    };
  }

  if (flow === "sell") {
    // Basic dealer verification question
    if (low.includes("verify")) {
      return {
        text:
`Verification (MVP idea):
• confirm dealer business identity + address
• match listings to a real inventory feed (CSV/XML/API)
• require a direct contact + payout method
• flag unusual pricing / duplicate VINs

UI-wise, we surface “Verified” badges and show *why* it’s verified.`,
        chips: ["Request offers anyway", "What info do you need from me?", "How do I avoid scams?"]
      };
    }

    // Parse a simple line like "2021 Model Y 42k 85001"
    const yr = low.match(/\b(20[0-2][0-9])\b/);
    const mi = low.match(/\b([0-9]{2,3})\s*k\b/);
    const zip = low.match(/\b([0-9]{5})\b/);

    let model = null;
    if (low.includes("model 3") || low.includes("m3")) model = "Model 3";
    if (low.includes("model y") || low.includes("my")) model = "Model Y";
    if (low.includes("model s") || low.includes("ms")) model = "Model S";
    if (low.includes("model x") || low.includes("mx")) model = "Model X";

    const hasEnough = !!(yr && model && (mi || low.includes("miles")) && zip);

    if (!hasEnough && (low.includes("vin") || low.includes("enter vin"))) {
      return {
        text:
`Great — for a VIN-based estimate, I’ll ask for:
• VIN
• mileage
• ZIP
• any accidents / title notes

(Prototype note: the UI is ready; backend can decode VIN and pull options.)`,
        chips: ["I’ll type the VIN", "Can I do it without VIN?", "What photos do you need?"]
      };
    }

    if (hasEnough) {
      const year = Number(yr[1]);
      const miles = mi ? Number(mi[1]) * 1000 : 40000;

      // Very rough demo estimate
      const base = model === "Model Y" ? 33000 : model === "Model 3" ? 25000 : model === "Model S" ? 36000 : 37000;
      const ageAdj = (2025 - year) * 900;
      const mileAdj = Math.max(0, (miles - 25000) / 1000) * 120;
      const est = Math.max(12000, base - ageAdj - mileAdj);
      const lowEst = Math.round(est * 0.92 / 100) * 100;
      const highEst = Math.round(est * 1.06 / 100) * 100;

      return {
        text:
`Based on a quick market-style estimate (demo), a reasonable *asking range* is:

• ${money(lowEst)} – ${money(highEst)}

If you want, I can request real cash offers from dealers (they’ll respond with a firm number).`,
        chips: ["Request dealer cash offers", "Show comps (examples)", "How do you pick dealers?", "What affects value most?"],
        actions: [{ type: "requestOffers", label: "Request dealer cash offers" }],
        cards: [
          { kind: "comp", title: "Example comps (mock)", items: makeMockComps(model, year, miles) }
        ]
      };
    }

    // General prompt
    return {
      text:
`To estimate value, send one line like:

“2021 Model Y • 42k miles • 85001”

Or you can enter VIN first.`,
      chips: ["2021 Model Y • 42k miles • 85001", "2020 Model 3 • 60k miles • 32801", "Enter VIN instead"]
    };
  }

  if (flow === "advertise") {
    if (low.includes("photos")) {
      return {
        text:
`Best photo set (quick, trust-building):
• front 3/4, rear 3/4, both sides
• wheels close-up (all 4)
• interior front + rear seats
• screen (software + options page)
• odometer
• any flaws (be honest)

If you share your year/model/trim, I’ll generate a listing checklist.`,
        chips: ["List my Model 3", "List my Model Y", "How do I price it?", "Can I hide my phone number?"]
      };
    }

    if (low.includes("price") || low.includes("pricing")) {
      return {
        text:
`Pricing approach for private listings:
1) pick 5–10 similar comps in your area
2) adjust for mileage, condition, and FSD/Autopilot
3) set asking price slightly above your “walk-away” number

I can help, but to fetch comps automatically you’ll want a licensed data feed (no scraping).`,
        actions: [{ type: "websearch", label: "Show a comps strategy + sources" }],
        chips: ["What data sources can we use?", "Help me write my listing", "Start a listing now"]
      };
    }

    return {
      text:
`Tell me your Tesla details and I’ll draft a clean listing:

Year, Model, Trim, Mileage, ZIP, and 3 honest notes (good/bad).`,
      chips: ["2022 Model 3 Performance • 27k miles • Austin TX", "2021 Model Y LR • 42k miles • Phoenix AZ", "What do I need to disclose?"]
    };
  }

  return { text: "How can I help?" };
}

function makeMockComps(model, year, miles) {
  // These are MOCK examples to show UI layout.
  // Replace with your backend comps (licensed provider / partner feed / your own marketplace data).
  const base = model === "Model Y" ? 34000 : model === "Model 3" ? 26000 : model === "Model S" ? 38000 : 39000;
  const adj = Math.max(0, (miles - 25000) / 1000) * 90;
  const p1 = Math.round((base - adj) / 100) * 100;
  return [
    { title: `${year} ${model} similar listing`, price: p1 + 1200, miles: miles - 3000, site: "Example marketplace" },
    { title: `${year} ${model} similar listing`, price: p1 + 500, miles: miles + 2000, site: "Example marketplace" },
    { title: `${year} ${model} similar listing`, price: p1 - 900, miles: miles + 7000, site: "Example marketplace" }
  ];
}

/* ---------------------------
   Mock “web search” results (replace with backend call)
----------------------------*/
function mockWebSearch(query) {
  // UI-only: show the pattern of “answer + sources”.
  // In production, your backend runs an actual web search + returns:
  // - answer text
  // - sources [{title, url}]
  // - extracted facts / snippets
  const q = (query || "").toLowerCase();
  let answer =
`I searched the web and found a few recent, high-signal sources.

Summary (demo):
• The “right” answer depends on your exact model year, software version, and Tesla policy changes.
• For anything policy-related, verify on Tesla’s own site/app and confirm with the seller/dealer.`;

  if (q.includes("federal") || q.includes("tax")) {
    answer =
`Web search summary (demo):
• EV tax credit rules change frequently and depend on buyer income + vehicle eligibility.
• Used EV credit has different thresholds than new EV credit.
• Always confirm the current IRS guidance and the exact vehicle eligibility before you purchase.`;
  }

  return {
    text: answer,
    sources: [
      { title: "Tesla Support / Owner resources (example)", url: "https://www.tesla.com/support" },
      { title: "NHTSA recalls (example)", url: "https://www.nhtsa.gov/recalls" },
      { title: "IRS EV credit guidance (example)", url: "https://www.irs.gov/credits-deductions" }
    ],
    chips: ["Ask a follow-up", "What should I verify on this listing?", "Show me matching inventory"]
  };
}

/* ---------------------------
   Actions from chips/buttons
----------------------------*/
function handleAction(action, context = {}) {
  if (!action) return;

  if (action.type === "websearch") {
    const q = context.query || "Tesla policy question";
    pushMsg({ role: "assistant", text: "Searching the web… (demo)" });
    render();
    setTimeout(() => {
      // Replace the last assistant msg (searching) with final result
      const chat = activeChat();
      chat.pop();
      const res = mockWebSearch(q);
      pushMsg({ role: "assistant", ...res });
      render();
      scrollChatToBottom();
    }, 650);
    return;
  }

  if (action.type === "requestOffers") {
    state.offers = MOCK_DEALER_OFFERS.map(x => ({ ...x }));
    toast("Offer request sent (demo)");
    navTo("#/offers");
    return;
  }
}

/* ---------------------------
   Render
----------------------------*/
function render() {
  const { name, params } = state.route;

  $app.innerHTML = "";
  const shell = el("div", { class: "shell" }, [
    renderTopbar(),
    el("main", { class: "main" }, [renderRoute(name, params)]),
    renderBottomNav()
  ]);
  $app.appendChild(shell);

  // Modal overlay (direct editing / selection tools)
  if (state.modal) {
    $app.appendChild(renderModal());
  }

  // If we're on agent route, try to keep latest messages visible
  if (name === "agent") {
    setTimeout(scrollChatToBottom, 0);
  }
}


function closeModal() {
  state.modal = null;
  render();
}

function renderModal() {
  const m = state.modal;
  if (!m) return el("div");

  // Only one modal type in this prototype: direct edit of a selected block.
  if (m.type !== "editBlock") return el("div");

  const msg = findMsgById(m.msgId);
  if (!msg) return el("div");

  const blocks = ensureBlocks(msg);
  const block = blocks[m.blockIndex];
  const initial = block ? block.text : "";

  const ta = el("textarea", {
    class: "modalTextarea",
    rows: "6"
  });
  ta.value = initial;

  const save = () => {
    const next = String(ta.value || "").trimEnd();
    if (!blocks[m.blockIndex]) return closeModal();
    blocks[m.blockIndex].text = next;

    // Keep pinned context in sync if it points at this exact block.
    if (state.pinnedContext && state.pinnedContext.msgId === m.msgId && state.pinnedContext.blockIndex === m.blockIndex) {
      state.pinnedContext.text = next;
    }

    toast("Updated");
    closeModal();
  };

  return el("div", {
    class: "modalOverlay",
    role: "dialog",
    "aria-modal": "true",
    onclick: (e) => {
      // Click outside closes.
      if (e.target === e.currentTarget) closeModal();
    }
  }, [
    el("div", {
      class: "modalCard",
      onclick: (e) => e.stopPropagation()
    }, [
      el("div", { class: "modalHeader" }, [
        el("div", { class: "modalTitle" }, ["Edit this section"]),
        el("button", { class: "modalX", "aria-label": "Close", onclick: closeModal }, ["✕"])
      ]),
      el("div", { class: "modalHint" }, [
        "Direct edit (no new prompt) — keep what’s good, tweak what isn’t."
      ]),
      ta,
      el("div", { class: "modalActions" }, [
        el("button", { class: "modalBtn", onclick: closeModal }, ["Cancel"]),
        el("button", { class: "modalBtn primary", onclick: save }, ["Save"])
      ])
    ])
  ]);
}

function renderTopbar() {
  const { name } = state.route;
  const isHome = name === "home";

  const titleMap = {
    // Keep the top bar short on mobile; the brand/site name can live in the home content.
    home: { title: "YoYo", subtitle: "How can I help you?" },
    agent: { title: BRAND.agentName, subtitle: flowSubtitle(state.activeFlow) },
    listing: { title: "Listing", subtitle: "Details + next steps" },
    offers: { title: "Dealer offers", subtitle: "Accept / decline (demo)" },
    saved: { title: "Saved", subtitle: "Shortlist your favorites" }
  };

  const t = titleMap[name] || titleMap.home;

  const left = [];

  if (!isHome) {
    left.push(
      el("button", {
        class: "iconbtn",
        "aria-label": "Back",
        onclick: () => history.back()
      }, [icon("back")])
    );
  }

  left.push(
    el("div", { class: "logo" }, [
      el("img", { src: BRAND.icon, alt: "YoYo" })
    ])
  );

  left.push(
    el("div", { class: "brandtext" }, [
      el("div", { class: "title" }, [t.title]),
      el("div", { class: "subtitle" }, [t.subtitle])
    ])
  );

  return el("header", { class: "topbar" }, [
    el("div", { class: "brand" }, left),
    el("div", { class: "tb-actions" }, [
      el("button", {
        class: "iconbtn",
        "aria-label": "Go home",
        onclick: () => navTo("#/home")
      }, [icon("home")]),
      el("button", {
        class: "iconbtn",
        "aria-label": "Reset conversation",
        onclick: () => {
          state.chatByFlow[state.activeFlow] = [];
          seedIfEmpty();
          toast("Reset");
          if (state.route.name !== "agent") navTo("#/agent?flow=" + state.activeFlow);
          else render();
        }
      }, [icon("reset")])
    ])
  ]);
}

function flowSubtitle(flow) {
  if (flow === "shop") return "Shop used Teslas (chat + voice)";
  if (flow === "sell") return "Cash offer agent (seller intake)";
  if (flow === "advertise") return "Create a listing (private or dealer)";
  return "Chat + voice";
}

function renderBottomNav() {
  const { name } = state.route;

  const items = [
    { key: "home", label: "Home", icon: "home", go: "#/home", active: name === "home" },
    { key: "shop", label: "Shop", icon: "search", go: "#/agent?flow=shop", active: name === "agent" && state.activeFlow === "shop" },
    { key: "sell", label: "Sell", icon: "tag", go: "#/agent?flow=sell", active: name === "agent" && state.activeFlow === "sell" },
    { key: "saved", label: "Saved", icon: "bookmark", go: "#/saved", active: name === "saved" },
    { key: "offers", label: "Offers", icon: "tag", go: "#/offers", active: name === "offers" }
  ];

  return el("nav", { class: "bottomnav", "aria-label": "Bottom navigation" }, [
    el("div", { class: "navInner" }, items.map((it) =>
      el("button", {
        class: "navbtn",
        dataset: { active: String(!!it.active) },
        onclick: () => navTo(it.go),
        "aria-label": it.label
      }, [icon(it.icon), el("span", {}, [it.label])])
    ))
  ]);
}

function renderRoute(name, params) {
  if (name === "home") return renderHome();
  if (name === "agent") return renderAgent(params);
  if (name === "listing") return renderListing(params);
  if (name === "offers") return renderOffers();
  if (name === "saved") return renderSaved();
  return renderHome();
}

/* ---------------------------
   Home
----------------------------*/
function renderHome() {
  return el("div", { class: "agentWrap" }, [
    el("section", { class: "card hero" }, [
      el("h1", {}, ["What do you want to do?"]),
      el("p", {}, [
        "This is a mobile-first UI prototype for OnlyUsedTesla.ai. It’s designed for clear chat bubbles, big touch targets, and Tesla product cards (dealer vs private)."
      ]),
      el("div", { class: "kpiRow" }, [
        pill("Chat + Voice", "One UI, two modes"),
        pill("Product cards", "Dealer / Private tags"),
        pill("Web-search fallback", "Show sources when needed")
      ]),
      el("div", { class: "ctaRow" }, [
        el("button", {
          class: "primarybtn",
          onclick: () => navTo("#/agent?flow=shop")
        }, [
          el("div", { class: "btnmeta" }, [
            el("div", { class: "label" }, ["Shop for a used Tesla"]),
            el("div", { class: "hint" }, ["Chat with YoYo → inventory cards + Q&A"])
          ]),
          el("span", {}, ["→"])
        ]),
        el("button", {
          class: "secondarybtn",
          onclick: () => navTo("#/agent?flow=sell")
        }, [
          el("div", { class: "btnmeta" }, [
            el("div", { class: "label" }, ["Get a cash offer for my Tesla"]),
            el("div", { class: "hint" }, ["Seller intake → dealers → accept/decline"])
          ]),
          el("span", {}, ["→"])
        ]),
        el("button", {
          class: "secondarybtn",
          onclick: () => navTo("#/agent?flow=advertise")
        }, [
          el("div", { class: "btnmeta" }, [
            el("div", { class: "label" }, ["Advertise my Tesla"]),
            el("div", { class: "hint" }, ["Create a listing with photos + notes"])
          ]),
          el("span", {}, ["→"])
        ])
      ]),
      el("div", { class: "note" }, [
        "Prototype notes: no backend, no real inventory feed, and no real dealer messaging. ",
        "In production you’d connect chat/voice to your LLM + inventory feed + dealer CRM.",
        el("br"),
        "Not affiliated with Tesla, Inc. “Tesla” is used to describe vehicle inventory only."
      ])
    ]),

    el("div", { class: "sectionTitle" }, ["Quick demo ideas"]),
    el("section", { class: "card hero" }, [
      el("p", {}, [
        "Tap Shop → ask: “Model 3 under $25k” → pick a card → Ask YoYo about FSD, warranty, or battery health. ",
        "If YoYo isn’t sure, it offers a “Search the web (with sources)” button."
      ])
    ])
  ]);
}

function pill(label, sub) {
  return el("span", { class: "pill" }, [
    el("strong", { style: "font-weight:820; color: rgba(246,247,251,.92)" }, [label]),
    el("span", {}, ["•"]),
    el("span", {}, [sub])
  ]);
}

/* ---------------------------
   Agent (Chat + Voice tab)
----------------------------*/
function renderAgent(params) {
  state.activeFlow = safeFlow(params.flow || state.activeFlow);

  return el("div", { class: "agentWrap" }, [
    el("div", { class: "segment", role: "tablist", "aria-label": "Chat or voice" }, [
      el("button", {
        class: "segbtn",
        dataset: { active: String(state.activeTab === "chat") },
        onclick: () => { state.activeTab = "chat"; render(); },
        role: "tab",
        "aria-selected": String(state.activeTab === "chat")
      }, ["Chat"]),
      el("button", {
        class: "segbtn",
        dataset: { active: String(state.activeTab === "voice") },
        onclick: () => { state.activeTab = "voice"; render(); },
        role: "tab",
        "aria-selected": String(state.activeTab === "voice")
      }, ["Voice"])
    ]),
    state.activeTab === "chat" ? renderChatPane() : renderVoicePane()
  ]);
}

function renderChatPane() {
  const chat = activeChat();

  const msglist = el("div", { class: "msglist", "data-msglist": "1" },
    chat.map(renderMsg)
  );

  const composer = renderComposer();

  return el("div", { class: "chat" }, [msglist, composer]);
}

function renderMsg(m) {
  const isUser = m.role === "user";
  const isTyping = !!m.typing;

  return el("div", { class: `msg ${isUser ? "user" : "assistant"}${isTyping ? " typing" : ""}` }, [
    !isUser
      ? el("div", { class: "avatar", "aria-hidden": "true" }, [
          el("img", { src: BRAND.icon, alt: "" })
        ])
      : null,
    el("div", {}, [
      el("div", { class: "bubble" }, [
        isTyping
          ? el("div", { class: "typingDots", "aria-label": "YoYo is thinking" }, [
              el("span"),
              el("span"),
              el("span")
            ])
          : (isUser ? (m.text || "") : renderAssistantBlocks(m))
      ]),
      isTyping ? el("div", { class: "thinkingMeta" }, [`${BRAND.agentName} is thinking…`]) : null,
      (m.cards && m.cards.length) ? renderCards(m.cards) : null,
      (m.chips && m.chips.length) ? renderChips(m.chips) : null,
      (m.actions && m.actions.length) ? renderActions(m.actions, m.text) : null,
      (m.sources && m.sources.length) ? renderSources(m.sources) : null
    ])
  ]);
}

function renderAssistantBlocks(m) {
  const blocks = ensureBlocks(m);

  // Fallback: if text didn't parse, render the raw string.
  if (!blocks || !blocks.length) {
    return el("div", { class: "bubbleText" }, [m.text || ""]);
  }

  const collapseThreshold = 6; // long responses become collapsible
  const showCount = 4;

  const canCollapse = blocks.length >= collapseThreshold;
  const collapsed = !!m.collapsed && canCollapse;

  const visible = collapsed ? blocks.slice(0, showCount) : blocks;

  const list = el("div", { class: "ablockList" }, visible.map((b, i) => renderAblock(m, i, b)));

  if (canCollapse) {
    const hidden = Math.max(0, blocks.length - showCount);
    list.appendChild(
      el("button", {
        class: "showMoreBtn",
        onclick: () => {
          // If collapsing hides the currently selected block, clear selection to avoid confusion.
          if (!collapsed && state.selection && state.selection.msgId === m.id && state.selection.blockIndex >= showCount) {
            state.selection = null;
          }
          m.collapsed = !collapsed;
          render();
        }
      }, [collapsed ? `Show ${hidden} more` : "Show less"])
    );
  }

  return list;
}

function renderAblock(msg, idx, block) {
  const selected = !!(state.selection && state.selection.msgId === msg.id && state.selection.blockIndex === idx);

  return el("div", {
    class: `ablock ${block.kind || "p"}`,
    dataset: { selected: String(selected) },
    role: "button",
    tabindex: "0",
    onclick: () => setSelection(msg.id, idx),
    onkeydown: (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setSelection(msg.id, idx);
      }
    }
  }, [
    el("span", { class: "ablockNum", "aria-hidden": "true" }, [String(idx + 1)]),
    el("div", { class: "ablockText" }, [block.text])
  ]);
}

function renderActions(actions, contextText) {
  return el("div", { class: "chips" },
    actions.map((a) => el("button", {
      class: "chip",
      dataset: { tone: a.type === "websearch" ? "danger" : "" },
      onclick: (e) => {
        flashChip(e.currentTarget);
        handleAction(a, { query: contextText });
      }
    }, [a.label || "Action"]))
  );
}

function renderChips(chips) {
  return el("div", { class: "chips" },
    chips.map((label) => el("button", {
      class: "chip",
      onclick: (e) => {
        flashChip(e.currentTarget);
        handleChip(label);
      }
    }, [label]))
  );
}

function flashChip(btn) {
  if (!btn) return;
  btn.dataset.glow = "true";
  // short “after tap” glow (helps on mobile where :active is fleeting)
  setTimeout(() => {
    if (!btn) return;
    delete btn.dataset.glow;
  }, 260);
}

function lastUserText() {
  const chat = activeChat();
  for (let i = chat.length - 1; i >= 0; i--) {
    if (chat[i]?.role === "user" && chat[i]?.text) return chat[i].text;
  }
  return "Tesla";
}

function handleChip(label) {
  const text = String(label || "").trim();
  const low = text.toLowerCase();

  // Shortcut chips
  if (low.includes("search the web")) {
    handleAction({ type: "websearch", label: "Search the web (with sources)" }, { query: lastUserText() });
    return;
  }
  if (low.includes("request dealer cash offers")) {
    handleAction({ type: "requestOffers", label: "Request dealer cash offers" });
    return;
  }

  // Flow routing chips
  if (low === "shop used teslas" || low.includes("shop used")) {
    navTo("#/agent?flow=shop");
    return;
  }
  if (low.includes("cash offer")) {
    navTo("#/agent?flow=sell");
    return;
  }
  if (low.includes("advertise")) {
    navTo("#/agent?flow=advertise");
    return;
  }

  // Default: treat the chip like a user prompt
  sendUser(text);
}

function renderSources(sources) {
  return el("div", { class: "sources" }, [
    el("div", { class: "label" }, ["Sources (demo)"]),
    el("div", { class: "sourcelist" }, sources.map((s) =>
      el("a", {
        class: "sourcelink",
        href: s.url,
        target: "_blank",
        rel: "noreferrer noopener"
      }, [
        el("span", {}, [s.title]),
        icon("external")
      ])
    ))
  ]);
}

function renderCards(cards) {
  // vehicle cards are shown in a horizontal row
  const vehicleCards = cards.filter(c => c.kind === "vehicle");
  const compCards = cards.filter(c => c.kind === "comp");

  const out = [];

  if (vehicleCards.length) {
    out.push(el("div", { class: "cardRow", role: "list" }, vehicleCards.map((c) => renderVehicleCard(c.id))));
  }

  if (compCards.length) {
    out.push(el("div", { class: "cardRow", role: "list" }, compCards.map((c) => renderCompCard(c))));
  }

  return el("div", {}, out);
}

function renderVehicleCard(id) {
  const v = INVENTORY.find(x => x.id === id);
  if (!v) return el("div", { class: "vcard" }, ["Unknown vehicle"]);

  const tagKind = v.sellerType === "dealer" ? "dealer" : "private";

  return el("div", { class: "vcard", role: "listitem" }, [
    el("div", { class: "vimg" }, [
      el("div", { class: "vinyl" }, [
        el("span", { class: "tag", dataset: { kind: tagKind } }, [v.sellerType === "dealer" ? "Dealer" : "Private"]),
        v.verifiedDealer ? el("span", { class: "tag", dataset: { kind: "verified" } }, ["Verified"]) : null
      ])
    ]),
    el("div", { class: "vbody" }, [
      el("div", { class: "vtitle" }, [`${v.year} ${v.model} ${v.trim}`]),
      el("div", { class: "vsub" }, [`${money(v.price)} • ${num(v.mileage)} mi • ${v.location}`]),
      el("div", { class: "vstats" }, [
        el("span", { class: "stat" }, [v.autopilot]),
        el("span", { class: "stat" }, [v.fsd]),
        el("span", { class: "stat" }, [v.rangeEst])
      ]),
      el("div", { class: "vactions" }, [
        el("button", {
          class: "smallbtn",
          onclick: () => toggleSave(v.id)
        }, [state.saved.has(v.id) ? "Saved ✓" : "Save"]),
        el("button", {
          class: "smallbtn primary",
          onclick: () => navTo(`#/listing?id=${encodeURIComponent(v.id)}`)
        }, ["View"])
      ])
    ])
  ]);
}

function renderCompCard(comp) {
  return el("div", { class: "vcard", role: "listitem" }, [
    el("div", { class: "vimg" }, [
      el("div", { class: "vinyl" }, [
        el("span", { class: "tag", dataset: { kind: "private" } }, ["Comps"]),
        el("span", { class: "tag" }, ["Examples"])
      ])
    ]),
    el("div", { class: "vbody" }, [
      el("div", { class: "vtitle" }, [comp.title || "Example comps"]),
      el("div", { class: "vsub" }, ["Mock comps to show UI layout (replace with licensed data)."]),
      el("div", { class: "vstats" }, (comp.items || []).map((x) =>
        el("span", { class: "stat" }, [`${money(x.price)} • ${num(x.miles)} mi`])
      )),
      el("div", { class: "vactions" }, [
        el("button", {
          class: "smallbtn primary",
          onclick: () => toast("In production: open comps list")
        }, ["Open comps"])
      ])
    ])
  ]);
}

function toggleSave(id) {
  if (state.saved.has(id)) {
    state.saved.delete(id);
    toast("Removed from saved");
  } else {
    state.saved.add(id);
    toast("Saved");
  }
  render();
}

function renderToolBtn(label, opts = {}) {
  return el("button", {
    class: `toolBtn${opts.tone ? " " + opts.tone : ""}`,
    onclick: (e) => {
      e.preventDefault();
      opts.onClick && opts.onClick();
    }
  }, [label]);
}

function renderPinnedContextCard() {
  const p = state.pinnedContext;
  if (!p || !p.text) return null;

  const preview = shortenText(p.text).replace(/^•\s*/g, "");

  return el("div", { class: "contextCard" }, [
    el("div", { class: "contextTop" }, [
      el("div", { class: "contextTitle" }, ["Pinned context"]),
      el("button", {
        class: "contextX",
        "aria-label": "Remove pinned context",
        onclick: () => {
          state.pinnedContext = null;
          render();
        }
      }, ["✕"])
    ]),
    el("div", { class: "contextPreview" }, [preview]),
    el("div", { class: "contextHint" }, [
      "Keeps this snippet visible so you don’t have to scroll (apple-picking helper)."
    ])
  ]);
}

function renderSelectionCard() {
  const sel = selectedBlock();
  if (!sel) return null;

  const preview = shortenText(sel.block.text).replace(/^•\s*/g, "");

  return el("div", { class: "contextCard" }, [
    el("div", { class: "contextTop" }, [
      el("div", { class: "contextTitle" }, [`Selected section #${sel.index + 1}`]),
      el("button", {
        class: "contextX",
        "aria-label": "Clear selection",
        onclick: () => {
          state.selection = null;
          render();
        }
      }, ["✕"])
    ]),
    el("div", { class: "contextPreview" }, [preview]),
    el("div", { class: "toolRow" }, [
      renderToolBtn("Edit", { onClick: () => applyBlockEdit("edit"), tone: "primary" }),
      renderToolBtn("Shorten", { onClick: () => applyBlockEdit("shorten") }),
      renderToolBtn("Expand", { onClick: () => applyBlockEdit("expand") }),
      renderToolBtn("Remove", { onClick: () => applyBlockEdit("remove"), tone: "danger" }),
      renderToolBtn("Pin", { onClick: () => applyBlockEdit("pin") })
    ]),
    el("div", { class: "contextHint" }, [
      "Tap any paragraph/bullet in YoYo’s message to point-to-select (accordion-editing helper)."
    ])
  ]);
}

function renderComposerContext() {
  const blocks = [];
  const selCard = renderSelectionCard();
  const pinCard = renderPinnedContextCard();
  if (pinCard) blocks.push(pinCard);
  if (selCard) blocks.push(selCard);

  if (!blocks.length) return null;

  return el("div", { class: "contextStack" }, blocks);
}

function renderComposer() {
  const placeholder = state.activeFlow === "shop"
    ? `Ask ${BRAND.agentName} about inventory, trims, options…`
    : state.activeFlow === "sell"
      ? `Type: “2021 Model Y • 42k miles • 85001”…`
      : `Describe your Tesla listing…`;

  const ta = el("textarea", {
    class: "textarea",
    rows: "1",
    placeholder,
    oninput: autoGrow,
    onkeydown: (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendUser(ta.value);
        ta.value = "";
        autoGrow({ target: ta });
      }
    }
  });

  const context = renderComposerContext();

  return el("div", { class: "composer" }, [
    context,
    el("div", { class: "composerInner" }, [
      el("div", {
        class: "inputWrap",
        // Makes the whole rounded container tappable (fat-finger friendly)
        onclick: () => ta.focus()
      }, [ta]),
      el("button", {
        class: "sendbtn",
        "aria-label": "Send",
        onclick: () => {
          sendUser(ta.value);
          ta.value = "";
          autoGrow({ target: ta });
        }
      }, [icon("send")])
    ])
  ]);
}

function autoGrow(e) {
  const ta = e.target;
  ta.style.height = "auto";
  ta.style.height = Math.min(120, ta.scrollHeight) + "px";
}

function sendUser(text) {
  const t = (text || "").trim();
  if (!t) return;

  pushMsg({ role: "user", text: t });

  // Optional: mark a selected listing if user pasted "Ask about listing ..."
  if (t.toLowerCase().includes("about") && t.toLowerCase().includes("m3p")) {
    state.selectedListingId = "m3p-2022-a1";
  }

  // Thinking indicator (so the user knows YoYo is working)
  pushMsg({ role: "assistant", typing: true });
  render();
  scrollChatToBottom();

  setTimeout(() => {
    const chat = activeChat();
    const last = chat[chat.length - 1];
    if (last && last.typing) chat.pop();

    const res = yoyoRespond(state.activeFlow, t);

    // Convenience: allow chip text to change flow
    if (res && res.chips) {
      // If user taps "Shop used Teslas" etc, we’ll route accordingly
      res.chips = res.chips.map((c) => {
        if (c === "Shop used Teslas") return "Shop used Teslas";
        return c;
      });
    }

    pushMsg({ role: "assistant", ...res });
    render();
    scrollChatToBottom();

    if (state.voice.speakResponses && state.activeTab === "voice") {
      speak(res.text);
    }
  }, 520);
}

/* ---------------------------
   Voice pane
----------------------------*/
let recognition = null;

function renderVoicePane() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

  const supported = state.voice.supported;

  const statusText = !supported
    ? "Voice not supported in this browser."
    : state.voice.listening
      ? "Listening… speak now"
      : "Idle";

  const onToggle = () => {
    if (!supported) {
      toast("Voice not supported here");
      return;
    }
    if (!state.voice.listening) startListening();
    else stopListening();
  };

  const speakToggle = el("button", {
    class: "chip",
    onclick: () => { state.voice.speakResponses = !state.voice.speakResponses; render(); }
  }, [state.voice.speakResponses ? "Speak responses: ON" : "Speak responses: OFF"]);

  const autosendToggle = el("button", {
    class: "chip",
    onclick: () => { state.voice.autoSend = !state.voice.autoSend; render(); }
  }, [state.voice.autoSend ? "Auto-send voice: ON" : "Auto-send voice: OFF"]);

  return el("div", { class: "voicePane" }, [
    el("section", { class: "card voiceCard" }, [
      el("div", { class: "voiceRow" }, [
        el("div", {}, [
          el("div", { style: "font-weight:820; letter-spacing:-0.02em; margin-bottom:4px;" }, ["YoYo Voice"]),
          el("div", { class: "status" }, [`Status: ${statusText}`])
        ]),
        el("button", {
          class: "micbtn",
          dataset: { on: String(state.voice.listening) },
          "aria-label": state.voice.listening ? "Stop voice" : "Start voice",
          onclick: onToggle
        }, [icon("mic")])
      ]),
      el("div", { class: "chips" }, [speakToggle, autosendToggle]),
      el("div", { class: "transcript" }, [
        state.voice.transcript
          ? state.voice.transcript
          : "Say something like: “Do you have a 2022 Model Y under 35k?”"
      ])
    ]),

    el("section", { class: "card hero" }, [
      el("p", {}, [
        "Voice is optional. In production you can route calls/kiosks to the same agent and show a real-time transcript here."
      ])
    ])
  ]);

  function startListening() {
    try {
      recognition = new SR();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      state.voice.listening = true;
      state.voice.transcript = "";
      render();

      recognition.onresult = (event) => {
        let transcript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        state.voice.transcript = transcript.trim();
        render();
      };

      recognition.onerror = () => {
        state.voice.listening = false;
        toast("Voice error (demo)");
        render();
      };

      recognition.onend = () => {
        state.voice.listening = false;
        render();
        if (state.voice.transcript && state.voice.autoSend) {
          // Send into chat flow
          state.activeTab = "chat";
          navTo(`#/agent?flow=${state.activeFlow}`);
          setTimeout(() => sendUser(state.voice.transcript), 0);
        }
      };

      recognition.start();
    } catch {
      state.voice.listening = false;
      toast("Could not start voice");
      render();
    }
  }

  function stopListening() {
    try { recognition && recognition.stop(); } catch {}
    state.voice.listening = false;
    render();
  }
}

function speak(text) {
  try {
    const u = new SpeechSynthesisUtterance(text || "");
    u.rate = 1.02;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch {
    // ignore
  }
}

/* ---------------------------
   Listing detail
----------------------------*/
function renderListing(params) {
  const id = params.id || "";
  const v = INVENTORY.find(x => x.id === id) || INVENTORY[0];

  const tagKind = v.sellerType === "dealer" ? "dealer" : "private";

  return el("div", { class: "detail" }, [
    el("section", { class: "card detailHero" }, [
      el("div", { class: "img" }, [
        el("div", { class: "vinyl" }, [
          el("span", { class: "tag", dataset: { kind: tagKind } }, [v.sellerType === "dealer" ? "Dealer" : "Private"]),
          v.verifiedDealer ? el("span", { class: "tag", dataset: { kind: "verified" } }, ["Verified"]) : null,
          el("span", { class: "tag" }, [money(v.price)])
        ])
      ]),
      el("div", { class: "detailBody" }, [
        el("h2", {}, [`${v.year} ${v.model} ${v.trim}`]),
        el("p", {}, [`${num(v.mileage)} miles • ${v.location} • Seller: ${v.sellerName}`]),

        el("div", { class: "grid" }, [
          kv("Autopilot", v.autopilot),
          kv("FSD", v.fsd),
          kv("Range", v.rangeEst),
          kv("Warranty", v.warranty),
          kv("Exterior", v.exterior),
          kv("Interior", v.interior)
        ]),

        el("div", { class: "actionCol" }, [
          el("button", {
            class: "fullbtn primary",
            onclick: () => {
              state.selectedListingId = v.id;
              navTo("#/agent?flow=shop");
              toast("Selected listing");
              // Drop a little context into chat
              pushMsg({
                role: "assistant",
                text: `Selected: ${v.year} ${v.model} ${v.trim} (${money(v.price)}). Ask me anything about this car.`
              });
              render();
            }
          }, ["Ask YoYo about this Tesla", el("span", {}, ["→"])]),
          el("button", {
            class: "fullbtn",
            onclick: () => toast("In production: schedule test drive")
          }, ["Schedule a test drive", el("span", {}, ["→"])]),
          el("button", {
            class: "fullbtn",
            onclick: () => toast("In production: leave a deposit")
          }, ["Leave a deposit (demo)", el("span", {}, ["→"])]),
          el("button", {
            class: "fullbtn",
            onclick: () => toast("In production: PAY OUT financing flow")
          }, ["Finance with PAY OUT (demo)", el("span", {}, ["→"])]),
          el("button", {
            class: "fullbtn",
            onclick: () => toggleSave(v.id)
          }, [state.saved.has(v.id) ? "Saved ✓ (remove)" : "Save this listing", el("span", {}, ["→"])])
        ]),

        el("div", { class: "note" }, [
          "If YoYo can’t answer a question from listing data, it can switch to “web search with sources” ",
          "or suggest what to verify (Tesla app, VIN/options page, service records)."
        ])
      ])
    ])
  ]);
}

function kv(k, v) {
  return el("div", { class: "kv" }, [
    el("div", { class: "k" }, [k]),
    el("div", { class: "v" }, [v])
  ]);
}

/* ---------------------------
   Saved
----------------------------*/
function renderSaved() {
  const ids = Array.from(state.saved.values());
  const items = ids.map((id) => INVENTORY.find(x => x.id === id)).filter(Boolean);

  return el("div", { class: "agentWrap" }, [
    el("section", { class: "card hero" }, [
      el("h1", {}, ["Saved Teslas"]),
      el("p", {}, [
        items.length ? "Tap a card to view details." : "No saved cars yet. Save a listing from the Shop flow."
      ])
    ]),
    items.length
      ? el("div", { class: "cardRow" }, items.map(x => renderVehicleCard(x.id)))
      : null
  ]);
}

/* ---------------------------
   Offers
----------------------------*/
function renderOffers() {
  const offers = state.offers && state.offers.length ? state.offers : [];

  return el("div", { class: "agentWrap" }, [
    el("section", { class: "card hero" }, [
      el("h1", {}, ["Dealer cash offers"]),
      el("p", {}, [
        offers.length
          ? "These are demo offers. In production: send seller intake to dealers → receive offers → show trust + next steps."
          : "No offers yet. Go to Sell and request dealer cash offers."
      ])
    ]),
    offers.length ? el("div", { class: "agentWrap" }, offers.map(renderOfferCard)) : null
  ]);
}

function renderOfferCard(o) {
  return el("section", { class: "card hero" }, [
    el("div", { style: "display:flex; align-items:center; justify-content:space-between; gap: 12px;" }, [
      el("div", {}, [
        el("div", { style: "font-weight:860; font-size:15px; letter-spacing:-0.02em;" }, [o.dealerName]),
        el("div", { style: "font-size:12px; color: rgba(246,247,251,.70); margin-top:2px;" }, [
          `${o.location} • Expires in ${o.expiresDays} day(s)`
        ])
      ]),
      el("div", { style: "display:flex; flex-direction:column; align-items:flex-end; gap:6px;" }, [
        el("div", { style: "font-weight:900; font-size:18px;" }, [money(o.offer)]),
        el("span", { class: "tag", dataset: { kind: o.verified ? "verified" : "private" } }, [
          o.verified ? "Verified dealer" : "Unverified"
        ])
      ])
    ]),
    el("p", {}, [o.terms]),
    el("div", { class: "chips" }, [
      el("button", {
        class: "chip",
        onclick: () => {
          toast("Accepted (demo)");
          pushMsg({ role: "assistant", text: `You accepted ${o.dealerName}'s offer (${money(o.offer)}). Next: ${o.nextSteps.join(" → ")} (demo).` });
          navTo("#/agent?flow=sell");
        }
      }, ["Accept"]),
      el("button", {
        class: "chip",
        onclick: () => toast("Declined (demo)")
      }, ["Decline"]),
      el("button", {
        class: "chip",
        onclick: () => {
          pushMsg({ role: "user", text: `Tell me more about ${o.dealerName}. Can I trust this offer?` });
          pushMsg({
            role: "assistant",
            text:
`Here’s how to build trust (demo):

• Check dealer business identity + reviews
• Confirm offer terms (inspection, transport, fees)
• Ask for the exact payout timeline
• Verify they can pay via secure method (wire, cashier’s check, etc.)

If you want, I can “web search with sources” to pull dealer info (production feature).`,
            actions: [{ type: "websearch", label: "Search the web (with sources)" }]
          });
          navTo("#/agent?flow=sell");
        }
      }, ["Ask YoYo"])
    ])
  ]);
}

/* ---------------------------
   Start
----------------------------*/
state.route = parseHash();
// Ensure flow is set if coming directly to agent
if (state.route.name === "agent" && state.route.params.flow) {
  state.activeFlow = safeFlow(state.route.params.flow);
}
render();
