# Travel Hack Stack

Live MCI flight deal scanner. Real Google Flights prices (via SerpApi), checked against my standing travel rules.

## What it does

| Tab | What it does | Searches used |
|---|---|---|
| Search | Round trip or one way, cheapest first, Book / Watch / Wait call, typical price range, price history | 1 (plus 1 per "Show return flights") |
| Split | 4 one-way legs through a hub (default MIA), picks the cheapest pairing with a 3hr+ hub buffer, compares to the round trip | 4 |
| Date Scan | Thu to Mon round trips 8, 9 and 10 weeks out, ranked by price | 3 |
| CPP | (cash - award taxes) / points x 100 | 0 |
| Rules | Standing rules and where each one is checked | 0 |
| AI Hack | Claude analysis using the live results from this session | 0 SerpApi |

Repeat searches within an hour are free (cached by the server and by SerpApi). The header shows searches left this month.

## Rule checks built in

- Layovers under 3hr at MIA/ATL/ORD/JFK/LAX, or under 2.5hr elsewhere, are flagged red
- Split tickets only pair flights with a 3hr+ buffer at the hub
- Last flight of the day on a split domestic leg is flagged
- LCCs (Frontier, Spirit, Arajet, Allegiant, Sun Country, Breeze, Avelo) get a bag policy warning
- Domestic round trips under $200 per person get a deal badge and a BOOK call

## Environment variables (set in Render, never in code)

| Name | Required | Notes |
|---|---|---|
| `SERPAPI_KEY` | Yes | From serpapi.com > Dashboard. Free plan: 250 searches/month, 50/hour |
| `ANTHROPIC_API_KEY` | For AI tab | From console.anthropic.com |
| `ANTHROPIC_MODEL` | No | Defaults to `claude-sonnet-4-6` |
| `ACCESS_CODE` | Recommended | Any passcode. Locks the app so strangers can't use up your searches |
| `CACHE_MINUTES` | No | Defaults to 60 |

## Deploy on Render

1. Render > travel-scanner > Environment: add the variables above. Delete `RAPIDAPI_KEY` if it is there.
2. Build command: `npm install`. Start command: `npm start`.
3. Push to `main`. Render redeploys automatically.

Render's free plan sleeps after 15 minutes idle, so the first load after a break takes about a minute.

## Run locally

```bash
npm install
SERPAPI_KEY=your_key npm start
# open http://localhost:3000
```

## Notes

- Prices are per person (searched as 1 adult) and multiplied by party size. With 3+ travelers, confirm seats at the same fare before booking.
- These are Google Flights shopping prices, not a booking. Book direct with the airline.
