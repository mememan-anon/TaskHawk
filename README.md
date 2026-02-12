# TaskHawk - Autonomous Flight Orchestrator

An AI-powered flight search agent with a web UI. Speak in natural language, get real flight prices, and every search is anchored on-chain via Walrus (Sui) for verifiable provenance.

**Track 2: Local God Mode** — OpenClaw Hackathon on DeepSurge

## Tech Stack

- **Node.js** — Runtime
- **Express** — API server + static file serving
- **OpenAI (GPT)** — LLM-based goal parsing and execution planning
- **SerpApi** — Real-time Google Flights pricing (no browser needed)
- **Puppeteer** — Browser automation fallback (local Chrome scraping)
- **Walrus / Sui Network** — Decentralized on-chain storage for execution traces
- **OpenClaw** — Browser tool bridge for LLM-driven web automation
- **Vanilla HTML/CSS/JS** — Lightweight frontend, no build step

## Quick Start

```bash
npm install
cp .env.example .env
# Add your OPENAI_API_KEY (required) and SERPAPI_KEY (for real prices) to .env
npm start
# Open http://localhost:3000
```

Type something like **"Find flights from nairobi to london under $800"** — supports city names, country names, and airport codes (70+ locations mapped).

## How It Works

1. You enter a natural language goal
2. LLM parses constraints and creates an execution plan
3. Flights are fetched (real prices via SerpApi, or mock data)
4. Results are validated against your constraints
5. Task + execution trace are stored to Walrus (Sui) for on-chain provenance
6. Flight cards, Walrus links, and trace summary are displayed in the UI

## Flight Data Modes

| Mode | Source | Where it works |
|------|--------|----------------|
| **Live (API)** | SerpApi → Google Flights | Everywhere (local, Vercel, any host) |
| **Browser** | Puppeteer → Google Flights | Local only |
| **Mock** | Built-in route data | Everywhere, no keys needed |

For real prices: sign up at [serpapi.com](https://serpapi.com) (100 free/month), add `SERPAPI_KEY` to `.env`.

## OpenClaw Integration

TaskHawk includes a full **OpenClaw browser tool bridge** (`browser-tool.js` + `src/executor/browser.js`) designed for LLM-driven agent environments. When running inside an OpenClaw runtime, an LLM agent can use TaskHawk's browser controller to:

- **Navigate** to any URL and interact with web pages
- **Snapshot** page state as structured accessibility elements (aria refs, roles, names)
- **Click**, **type**, and **fill forms** using multi-strategy element finding (by aria reference, role/name, or text content)
- **Wait for elements** to appear with configurable timeouts
- **Retry automatically** on failures with exponential backoff

The bridge works by accepting OpenClaw's injected `browser` function and wrapping it with higher-level automation primitives. Outside OpenClaw, it gracefully degrades to mock responses so the rest of the system (LLM planning, flight search, Walrus storage) continues to work.

```javascript
// In an OpenClaw environment, an LLM agent can do:
import { initBrowserTool } from './browser-tool.js';
import { BrowserController } from './src/executor/browser.js';

initBrowserTool(openClawBrowserFn); // inject the runtime's browser function

const browser = new BrowserController({ verbose: true });
await browser.navigate('https://example.com');
const snapshot = await browser.snapshot();   // structured page elements
await browser.click('Search');               // finds by role, name, or text
await browser.type('Email', 'user@test.com');
await browser.fillForm({ Name: 'John', Email: 'john@test.com' });
```

This is fully implemented and ready for any OpenClaw-compatible LLM agent to use — it just needs the runtime to provide the browser function.

## Environment Variables

```env
OPENAI_API_KEY=your_key        # Required — LLM planning
SERPAPI_KEY=your_key            # Optional — real flight prices
# Walrus defaults to Sui testnet, override if needed:
# WALRUS_PUBLISHER_URL=https://publisher.walrus-testnet.walrus.space
# WALRUS_AGGREGATOR_URL=https://aggregator.walrus-testnet.walrus.space
```

## API

| Method | Path | Body | Description |
|--------|------|------|-------------|
| `GET` | `/api/health` | — | Health check |
| `POST` | `/api/search` | `{ goal, mode }` | Search flights. `mode`: `"api"`, `"mock"`, or `"real"` |

## CLI (optional)

```bash
node test-demo-mock.js                                              # Mock, no keys needed
node src/demo-cli.js --goal "Flights SFO to JFK under $500"         # LLM + mock
node src/demo-cli.js --goal "Flights NBO to JFK" --real             # LLM + real Chrome
```

---

**Built for the OpenClaw Hackathon — Track 2: Local God Mode**
Submit on [DeepSurge](https://deepsurge.xyz)
