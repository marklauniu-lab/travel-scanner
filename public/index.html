const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || "c86169108msh4c89a06cf763be7p1091e8jsnaa1638504508";
const RAPIDAPI_HOST = "sky-scrapper.p.rapidapi.com";

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const apiHeaders = {
  "x-rapidapi-key": RAPIDAPI_KEY,
  "x-rapidapi-host": RAPIDAPI_HOST,
  "Content-Type": "application/json",
};

// Helper: proxy a GET request to Sky Scrapper
async function proxySkyScapper(endpoint, params) {
  const url = new URL(`https://sky-scrapper.p.rapidapi.com${endpoint}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") url.searchParams.append(k, v);
  });
  const res = await fetch(url.toString(), { method: "GET", headers: apiHeaders });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// Route: Search airport (resolve SkyId + EntityId)
app.get("/api/airport", async (req, res) => {
  try {
    const data = await proxySkyScapper("/api/v1/flights/searchAirport", {
      query: req.query.q,
      locale: "en-US",
    });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Route: Search flights (round trip or one-way)
app.get("/api/flights", async (req, res) => {
  try {
    const data = await proxySkyScapper("/api/v2/flights/searchFlights", {
      originSkyId: req.query.originSkyId,
      destinationSkyId: req.query.destinationSkyId,
      originEntityId: req.query.originEntityId,
      destinationEntityId: req.query.destinationEntityId,
      date: req.query.date,
      returnDate: req.query.returnDate,
      adults: req.query.adults || 1,
      currency: "USD",
      market: "en-US",
      countryCode: "US",
      cabinClass: req.query.cabinClass || "economy",
    });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Route: Price calendar
app.get("/api/calendar", async (req, res) => {
  try {
    const data = await proxySkyScapper("/api/v1/flights/getPriceCalendar", {
      originSkyId: req.query.originSkyId,
      destinationSkyId: req.query.destinationSkyId,
      fromDate: req.query.fromDate,
      currency: "USD",
    });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Route: Nearby airports
app.get("/api/nearby", async (req, res) => {
  try {
    const data = await proxySkyScapper("/api/v1/flights/getNearByAirports", {
      lat: req.query.lat || "39.2976",
      lng: req.query.lng || "-94.7139",
      locale: "en-US",
    });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Route: Search flights everywhere (flexible destination)
app.get("/api/everywhere", async (req, res) => {
  try {
    const data = await proxySkyScapper("/api/v1/flights/searchFlightEverywhere", {
      originSkyId: req.query.originSkyId,
      originEntityId: req.query.originEntityId,
      cabinClass: "economy",
      currency: "USD",
    });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Route: Claude AI hack analysis
app.post("/api/ai", async (req, res) => {
  try {
    const { query, context } = req.body;
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY || "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        system: `You are an expert travel hacker. Sharp, accurate, no fluff.
${context || ""}
Rules: MCI only. Under $200 domestic RT. Thu-Mon preferred. Min 3hr layover at major hubs (MIA/ATL/ORD). Always CPP math. Always Book vs Wait call. Flag any layover risks.`,
        messages: [{ role: "user", content: query }],
      }),
    });
    const data = await response.json();
    const text = data.content?.find((b) => b.type === "text")?.text || "No response.";
    res.json({ response: text });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Fallback: serve frontend
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Travel Scanner running on port ${PORT}`);
});
