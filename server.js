// Travel Hack Stack: MCI flight deal scanner
// Backend proxy for SerpApi (Google Flights) + Claude analysis.
// All keys come from environment variables. Never hardcode keys in this file.

const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

const SERPAPI_KEY = process.env.SERPAPI_KEY || "";
const SERPAPI_BASE = process.env.SERPAPI_BASE || "https://serpapi.com";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
const ACCESS_CODE = process.env.ACCESS_CODE || ""; // optional: locks the app so strangers can't burn your quota
const CACHE_MINUTES = parseInt(process.env.CACHE_MINUTES || "60", 10);

app.use(express.json({ limit: "100kb" }));
app.use(express.static(path.join(__dirname, "public")));

// ---------- Access lock (only active if ACCESS_CODE is set) ----------
app.use("/api", (req, res, next) => {
  if (req.path === "/health") return next();
  if (!ACCESS_CODE) return next();
  if (req.get("x-access-code") === ACCESS_CODE) return next();
  res.status(401).json({ error: "Access code required.", needsCode: true });
});

// ---------- Simple in-memory cache ----------
const cache = new Map();
function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.t > CACHE_MINUTES * 60000) { cache.delete(key); return null; }
  return hit.v;
}
function cacheSet(key, v) {
  if (cache.size > 300) cache.delete(cache.keys().next().value);
  cache.set(key, { t: Date.now(), v });
}

// ---------- SerpApi helper ----------
const IATA = /^[A-Z]{3}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

async function serp(params) {
  if (!SERPAPI_KEY) throw new Error("SERPAPI_KEY is not set on the server.");
  const url = new URL("/search.json", SERPAPI_BASE);
  url.searchParams.set("engine", "google_flights");
  url.searchParams.set("currency", "USD");
  url.searchParams.set("hl", "en");
  url.searchParams.set("gl", "us");
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  });
  const cacheKey = url.toString();
  const cached = cacheGet(cacheKey);
  if (cached) return { data: cached, cached: true };

  url.searchParams.set("api_key", SERPAPI_KEY);
  const res = await fetch(url.toString());
  let data;
  try { data = await res.json(); } catch { throw new Error(`SerpApi returned an unreadable response (${res.status}).`); }

  if (data.error) {
    // "No results" is a normal empty answer, not a failure
    if (/hasn't returned any results|no results/i.test(data.error)) {
      data = { best_flights: [], other_flights: [], _empty: true };
    } else {
      throw new Error(data.error);
    }
  } else if (!res.ok) {
    throw new Error(`SerpApi error ${res.status}`);
  }
  cacheSet(cacheKey, data);
  return { data, cached: false };
}

// Turn SerpApi itineraries into one clean shape for the frontend
function normalize(data) {
  const all = [
    ...(data.best_flights || []).map((f) => ({ ...f, _best: true })),
    ...(data.other_flights || []),
  ];
  const itineraries = all
    .filter((f) => typeof f.price === "number" && Array.isArray(f.flights) && f.flights.length)
    .map((f) => {
      const first = f.flights[0];
      const last = f.flights[f.flights.length - 1];
      return {
        price: f.price,
        best: !!f._best,
        type: f.type || "",
        totalDuration: f.total_duration || null,
        departTime: first.departure_airport?.time || "",
        arriveTime: last.arrival_airport?.time || "",
        from: first.departure_airport?.id || "",
        to: last.arrival_airport?.id || "",
        stops: f.flights.length - 1,
        airlines: [...new Set(f.flights.map((s) => s.airline).filter(Boolean))],
        segments: f.flights.map((s) => ({
          from: s.departure_airport?.id, to: s.arrival_airport?.id,
          dep: s.departure_airport?.time, arr: s.arrival_airport?.time,
          airline: s.airline, flightNumber: s.flight_number, duration: s.duration,
          overnight: !!s.overnight, oftenDelayed: !!s.often_delayed_by_over_30_min,
        })),
        layovers: (f.layovers || []).map((l) => ({
          airport: l.id, name: l.name, minutes: l.duration, overnight: !!l.overnight,
        })),
        extensions: f.extensions || [],
        departureToken: f.departure_token || null,
      };
    })
    .sort((a, b) => a.price - b.price);

  const pi = data.price_insights || null;
  const arrivalInfo = data.airports?.[0]?.arrival?.[0] || null;
  return {
    itineraries,
    insights: pi ? {
      lowest: pi.lowest_price ?? null,
      level: pi.price_level || null,
      typicalRange: pi.typical_price_range || null,
      history: (pi.price_history || []).slice(-60),
    } : null,
    destCountry: arrivalInfo?.country_code || null,
    destCity: arrivalInfo?.city || null,
    googleUrl: data.search_metadata?.google_flights_url || null,
  };
}

function validate(q, needReturn) {
  const from = String(q.from || "").toUpperCase();
  const to = String(q.to || "").toUpperCase();
  if (!IATA.test(from) || !IATA.test(to)) throw new Error("Use 3-letter airport codes (e.g. MCI, DEN).");
  if (from === to) throw new Error("Origin and destination are the same.");
  if (!DATE.test(q.depart || "")) throw new Error("Pick a departure date.");
  if (needReturn && !DATE.test(q.return || "")) throw new Error("Pick a return date.");
  return { from, to };
}

// ---------- Routes ----------
app.get("/api/health", (req, res) => {
  res.json({ ok: true, serpapi: !!SERPAPI_KEY, ai: !!ANTHROPIC_API_KEY, locked: !!ACCESS_CODE });
});

// Monthly quota (SerpApi account endpoint does not count against searches)
app.get("/api/usage", async (req, res) => {
  try {
    if (!SERPAPI_KEY) throw new Error("SERPAPI_KEY is not set on the server.");
    const url = new URL("/account.json", SERPAPI_BASE);
    url.searchParams.set("api_key", SERPAPI_KEY);
    const r = await fetch(url.toString());
    const d = await r.json();
    if (d.error) throw new Error(d.error);
    res.json({
      plan: d.plan_name || null,
      perMonth: d.searches_per_month ?? null,
      left: d.plan_searches_left ?? d.total_searches_left ?? null,
      used: d.this_month_usage ?? null,
      hourlyLimit: d.account_rate_limit_per_hour ?? null,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Round trip (type 1) or one way (type 2). 1 search credit.
app.get("/api/search", async (req, res) => {
  try {
    const oneWay = req.query.type === "2";
    const { from, to } = validate(req.query, !oneWay);
    const { data, cached } = await serp({
      departure_id: from,
      arrival_id: to,
      outbound_date: req.query.depart,
      return_date: oneWay ? undefined : req.query.return,
      type: oneWay ? 2 : 1,
      adults: 1, // priced per person; frontend multiplies by party size
      stops: ["0", "1", "2", "3"].includes(req.query.stops) ? req.query.stops : undefined,
      show_hidden: "true",
    });
    res.json({ ...normalize(data), cached });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Return flights for a chosen outbound. 1 search credit.
app.get("/api/returns", async (req, res) => {
  try {
    const { from, to } = validate(req.query, true);
    if (!req.query.token) throw new Error("Missing departure token.");
    const { data, cached } = await serp({
      departure_id: from,
      arrival_id: to,
      outbound_date: req.query.depart,
      return_date: req.query.return,
      type: 1,
      adults: 1,
      departure_token: req.query.token,
    });
    res.json({ ...normalize(data), cached });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Claude travel-hack analysis
app.post("/api/ai", async (req, res) => {
  try {
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set on the server.");
    const query = String(req.body?.query || "").slice(0, 2000);
    const context = String(req.body?.context || "").slice(0, 8000);
    if (!query) throw new Error("Ask a question first.");
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 1000,
        system: `You are an expert travel hacker. Sharp, accurate, no fluff, no em dashes.
Standing rules: MCI departures only. Domestic deals under $200 RT per person. Thu-Mon travel preferred. Search 8-10 weeks out. Min 3hr layover at MIA/ATL/ORD/JFK/LAX, 2.5hr elsewhere. On split tickets never use the last flight of the day for the domestic leg and keep a 3hr+ buffer before international departures. Confirm bag policy on LCCs (Frontier, Spirit, Arajet).
CPP math: (cash price - taxes and fees) / points x 100. Points win above ~1.3 cents.
Loyalty: United MileagePlus (primary), Air Canada Aeroplan, Southwest Rapid Rewards. Chase UR and Amex MR transfer 1:1 to United and Aeroplan. Hotels: Hyatt first, Marriott second.
Only use prices given in the context below. If no live prices are provided, say so and do not invent fares.
Always end with a clear BOOK or WAIT call and the reason.

Live context:
${context}`,
        messages: [{ role: "user", content: query }],
      }),
    });
    const data = await response.json();
    if (data.error) throw new Error(data.error.message || "Claude API error.");
    const text = data.content?.find((b) => b.type === "text")?.text || "No response.";
    res.json({ response: text });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.use("/api", (req, res) => res.status(404).json({ error: "Unknown API route." }));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Travel Hack Stack running on port ${PORT}`);
  if (!SERPAPI_KEY) console.warn("WARNING: SERPAPI_KEY is not set. Searches will fail.");
});
