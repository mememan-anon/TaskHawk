# TaskHawk - Autonomous Web Task Orchestrator

An intelligent system that plans and executes web-based tasks using LLM-powered decomposition, real browser automation (Puppeteer + Google Flights), and decentralized storage on Walrus (Sui Network).

**Track 2: Local God Mode** — OpenClaw Hackathon on DeepSurge

## Quick Start

### 1. Install & Setup

```bash
npm install
cp .env.example .env
# Edit .env and add your OpenAI API key
```

### 2. Run the Demo

```bash
# Mock demo (works immediately, no API key needed)
node test-demo-mock.js

# Full run with LLM planning (requires OpenAI API key)
node src/demo-cli.js --goal "Find flights from SFO to JFK under 500 dollars"

# REAL browser automation — opens Chrome, scrapes Google Flights (requires OpenAI API key)
node src/demo-cli.js --goal "Find flights from NBO to JFK" --real

# Interactive demo CLI
npm run demo
```

### 3. Expected Output

The demo will:
- Parse your flight search goal and extract constraints
- Create an execution plan via LLM (or mock plan)
- Search for flights — mock data or **real Google Flights via Puppeteer**
- Validate results against your constraints
- Store task definition & execution trace to **Walrus (Sui Network)**
- Display clickable Walrus URLs to view your data on-chain

## What is TaskHawk?

TaskHawk is an autonomous task orchestrator that:
1. **Understands** natural language goals using LLMs
2. **Plans** by breaking goals into executable steps
3. **Executes** via real browser automation (Puppeteer → Google Flights) or OpenClaw
4. **Logs** every step for transparency and debugging
5. **Stores** results to decentralized storage (Walrus on Sui) for verifiable provenance

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER GOAL                               │
│                  "Find flights SFO->JFK under $500"            │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                v
┌─────────────────────────────────────────────────────────────────┐
│                    TASK PLANNER (LLM)                          │
│  - Parse goal & extract constraints                            │
│  - Decompose into atomic steps                                 │
│  - Create execution plan with dependencies                     │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                v
┌─────────────────────────────────────────────────────────────────┐
│                   ACTION EXECUTOR                              │
│  navigate | fill_form | click | type | extract | wait | snap   │
└───────────────────┬───────────────────┬─────────────────────────┘
                    │                   │
                    v                   v
┌───────────────────────────┐  ┌──────────────────────────────────┐
│   BROWSER AUTOMATION      │  │  PERSISTENT LOGGER               │
│   - Puppeteer (Chrome)    │  │  - Track all steps               │
│   - Google Flights live   │  │  - Store to Walrus               │
│   - OpenClaw bridge       │  │  - Graceful degradation          │
│   - Mock fallback         │  │                                  │
└───────────────────────────┘  └──────────────┬───────────────────┘
                                              │
                                              v
                                 ┌────────────────────────────────┐
                                 │     WALRUS STORAGE (Sui)       │
                                 │                                │
                                 │  Publisher: store blobs        │
                                 │  Aggregator: retrieve blobs   │
                                 │  Decentralized provenance     │
                                 └────────────────────────────────┘
```

## Browser Automation Modes

| Mode | Flag | Description |
|------|------|-------------|
| **Mock** | _(default)_ | Uses realistic mock flight data. No browser needed. |
| **Real** | `--real` | Launches Chrome via Puppeteer, scrapes Google Flights for live prices. |
| **OpenClaw** | _(via runtime)_ | Uses OpenClaw's injected browser function when available. |

### Real Browser Mode

When you use `--real`, TaskHawk:
1. Launches a real Chrome browser via Puppeteer
2. Navigates to Google Flights with your search query
3. Waits for flight results to load
4. Extracts airline, price, duration, stops, and times from the page
5. Takes a screenshot as proof
6. Stores real results to Walrus for on-chain verification

```bash
# Example: Real flight search
node src/demo-cli.js --goal "Find flights from NBO to JFK" --real --verbose
```

## Environment Variables

Create a `.env` file (or copy from `.env.example`):

```env
# Required for LLM-powered mode (not needed for mock demo)
OPENAI_API_KEY=your_api_key_here

# Optional: Model override (default: gpt-3.5-turbo)
# OPENAI_MODEL=gpt-3.5-turbo

# Walrus Decentralized Storage (Sui Network)
# These default to the official testnet endpoints
WALRUS_PUBLISHER_URL=https://publisher.walrus-testnet.walrus.space
WALRUS_AGGREGATOR_URL=https://aggregator.walrus-testnet.walrus.space
```

## Walrus Integration (Sui Network)

TaskHawk stores execution data to Walrus decentralized storage on the Sui network. Every demo run produces two blob IDs with on-chain provenance.

### What Gets Stored

| Blob | Contents |
|------|----------|
| **Task** | Goal, parsed constraints, session ID, timestamps |
| **Trace** | Every execution step, results, errors, final output |

### Retrieve Your Data

After running the demo, you'll see Walrus URLs in the output. You can retrieve your data in three ways:

**1. Browser** — click or paste the URL:
```
https://aggregator.walrus-testnet.walrus.space/v1/blobs/YOUR_BLOB_ID
```

**2. Code:**
```javascript
import { WalrusClient } from './src/walrus/client.js';
const client = new WalrusClient();
const result = await client.retrieve('YOUR_BLOB_ID');
console.log(result.data);
```

**3. Test connectivity:**
```bash
npm run test:storage
```

### Walrus API Endpoints

| Service | URL | Purpose |
|---------|-----|---------|
| Publisher | `https://publisher.walrus-testnet.walrus.space` | Store blobs (`PUT /v1/blobs`) |
| Aggregator | `https://aggregator.walrus-testnet.walrus.space` | Read blobs (`GET /v1/blobs/{id}`) |

### Graceful Degradation

If Walrus is unavailable, the demo continues normally — results are displayed, and a warning is shown about storage. No impact on core functionality.

## Project Structure

```
taskhawk/
├── src/
│   ├── index.js              # Main CLI entry point
│   ├── demo-cli.js           # Demo CLI entry point
│   ├── planner/
│   │   └── index.js          # TaskPlanner (LLM-based decomposition)
│   ├── executor/
│   │   ├── index.js          # ActionExecutor (8 action types)
│   │   ├── browser.js        # BrowserController (OpenClaw bridge)
│   │   └── flights-browser.js # Real Flights scraper (Puppeteer)
│   ├── logger/
│   │   └── index.js          # ExecutionLogger & PersistentLogger
│   ├── walrus/
│   │   └── client.js         # WalrusClient (Sui storage)
│   ├── demo/
│   │   ├── index.js          # Demo module exports
│   │   ├── flight-demo.js    # FlightDemo (end-to-end orchestrator)
│   │   └── runner.js         # DemoRunner (interactive)
│   └── utils/
│       └── parsers.js        # Goal parsing utilities
├── browser-tool.js           # OpenClaw browser tool bridge
├── test-demo-mock.js         # Mock demo (no API key needed)
├── package.json
├── .env.example
└── README.md
```

## Testing

```bash
# Mock demo — works immediately, no API key needed
node test-demo-mock.js

# Test Walrus storage connectivity (store + retrieve round trip)
npm run test:storage

# Full LLM demo with mock flight data
node src/demo-cli.js --goal "Find flights from SFO to JFK under 500 dollars"

# Full LLM demo with REAL browser automation
node src/demo-cli.js --goal "Find flights from NBO to JFK" --real

# Interactive demo
npm run demo
```

## CLI Reference

```
node src/demo-cli.js [options]

Options:
  -g, --goal <text>   The goal to accomplish (required)
  -t, --type <type>   Demo type: flight (default: flight)
  -v, --verbose       Enable verbose output
  --real              Use real browser (Puppeteer + Google Flights)
  -h, --help          Show help message
```

## API Reference

### FlightDemo

```javascript
import { FlightDemo } from './src/demo/flight-demo.js';

const demo = new FlightDemo({
  mockData: true,   // Use mock flight data (no browser needed)
  verbose: false
});

const results = await demo.run('Find flights from SFO to JFK under $500');
console.log(results.flights);    // Array of flight objects
console.log(results.formatted);  // Top 3 formatted flights
console.log(results.storage);    // Walrus blob IDs
await demo.cleanup();
```

### WalrusClient

```javascript
import { WalrusClient } from './src/walrus/client.js';

const client = new WalrusClient({ verbose: true });

// Store data
const stored = await client.store({ any: 'json data' });
console.log(stored.blobId); // e.g. "34Q38qkVrZ0dbQANKLova_CBbBC7ecJoqYB-5h7l5dc"

// Retrieve data
const retrieved = await client.retrieve(stored.blobId);
console.log(retrieved.data); // { any: 'json data' }

// Test connectivity
const test = await client.testConnectivity();
console.log(test.success); // true
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "OPENAI_API_KEY not set" | Add your key to `.env` — or use `node test-demo-mock.js` which doesn't need one |
| Walrus storage fails | Check network connectivity. Demo continues without storage via graceful degradation |
| Chrome won't launch | Run `npx puppeteer browsers install chrome` to install Chrome for Puppeteer |
| `--real` returns no flights | Google may block automated requests. Results fall back to mock data automatically |
| Slow demo | LLM response time varies. Mock mode (`test-demo-mock.js`) is faster for testing |

---

**Built for the OpenClaw Hackathon — Track 2: Local God Mode**
Submit on [DeepSurge](https://deepsurge.xyz)
