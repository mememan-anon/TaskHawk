# Mad Sniper - Autonomous Web Task Orchestrator

An intelligent system that plans and executes web-based tasks using LLM-powered decomposition and execution.

## 🚀 Quick Start for Judges

### 1. Installation & Setup

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env and add your OpenAI API key
# OPENAI_API_KEY=your_key_here
```

### 2. Run the Flight Demo

```bash
# Quick demo script (easiest way)
./demo-flight.sh

# Or use npm script
npm run demo:flight

# Or run with custom goal
npm run demo -- --goal "Find flights from SFO to JFK under $500"
```

### 3. Expected Output

The demo will:
- ✅ Parse your flight search goal
- ✅ Create an execution plan using LLM
- ✅ Search for flights (mock data)
- ✅ Validate results against constraints
- ✅ Store task & trace to Walrus (decentralized storage)
- ✅ Display top 3 flight options with prices
- ✅ Show Walrus blob IDs for provenance

**Demo Duration:** ~30-60 seconds (depends on LLM response time)

## 📋 What is Mad Sniper?

Mad Sniper is an autonomous task orchestrator that:
1. **Understands** natural language goals using LLMs
2. **Plans** by breaking goals into executable steps
3. **Executes** by automating web browser actions
4. **Logs** every step for transparency and debugging
5. **Stores** results to decentralized storage (Walrus on Sui)

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER GOAL                               │
│                  "Find flights SFO→JFK under $500"             │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    TASK PLANNER (LLM)                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  1. Parse goal & extract constraints                     │   │
│  │  2. Decompose into atomic steps                         │   │
│  │  3. Create execution plan with dependencies              │   │
│  └─────────────────────────────────────────────────────────┘   │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                   ACTION EXECUTOR                              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  • Navigate to URLs                                   │   │
│  │  • Fill forms & type text                              │   │
│  │  • Click elements & interact                           │   │
│  │  • Extract data from pages                              │   │
│  │  • Handle errors & retry                               │   │
│  └─────────────────────────────────────────────────────────┘   │
└───────────────────────┬───────────────────┬───────────────────┘
                        │                   │
                        ▼                   ▼
┌────────────────────────────────┐  ┌──────────────────────────┐
│   BROWSER CONTROLLER          │  │  PERSISTENT LOGGER      │
│                              │  │                          │
│  - OpenClaw browser tool     │  │  - Track all steps       │
│  - Multi-strategy finding     │  │  - Store to Walrus       │
│  - Retry logic                │  │  - Trace provenance      │
│  - Error handling             │  │  - Graceful degradation  │
└────────────────────────────────┘  └──────────────┬───────────┘
                                                │
                                                ▼
                                   ┌──────────────────────────┐
                                   │     WALRUS STORAGE       │
                                   │   (Sui Network)          │
                                   │                          │
                                   │  • Task definition blob  │
                                   │  • Execution trace blob  │
                                   │  • Decentralized access  │
                                   └──────────────────────────┘
```

## 📦 Installation

```bash
# Clone the repository
git clone <repository-url>
cd mad-sniper

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env and add your OpenAI API key
```

### Environment Variables

Create a `.env` file with:

```env
# Required: OpenAI API key
OPENAI_API_KEY=your_api_key_here

# Optional: Model selection (default: gpt-3.5-turbo)
OPENAI_MODEL=gpt-3.5-turbo

# Optional: Debug mode
DEBUG=false
```

## 💻 Usage

### Demo Mode (Recommended for First Try)

```bash
# Run flight demo with default goal
./demo-flight.sh

# Run with custom goal
./demo-flight.sh "Find flights from LAX to ORD under $300"

# Or use the demo CLI
npm run demo -- --goal "Your flight search goal"
```

### Standard Mode (Planning Only)

```bash
# Basic planning mode
node src/index.js --goal "Find flights from SFO to JFK"

# Verbose output
node src/index.js --goal "Find flights..." --verbose

# Dry run (no execution)
node src/index.js --goal "Find flights..." --dry-run
```

### Interactive Mode

```bash
# Run demo without goal argument for interactive prompt
node src/demo-cli.js
# Then enter your goal when prompted
```

## 🎯 Demo Examples

### Flight Search

```bash
./demo-flight.sh "Find flights from SFO to JFK next week under $500"
```

**Output includes:**
- Top 3 flight options sorted by price
- Airline, flight number, times, duration
- Price and stops information
- Walrus blob IDs for provenance

### Custom Flight Goals

```bash
./demo-flight.sh "Search for flights from New York to London under $800"
./demo-flight.sh "Find flights from LAX to ORD under $300"
./demo-flight.sh "Find flights from SFO to LAX nonstop"
```

## 🔧 Project Structure

```
mad-sniper/
├── browser-tool.js       # OpenClaw browser tool bridge
├── src/
│   ├── planner/          # LLM-based task decomposition
│   │   └── index.js      # TaskPlanner class
│   ├── executor/         # Step execution engine
│   │   ├── index.js      # ActionExecutor class
│   │   └── browser.js    # BrowserController class
│   ├── logger/           # Execution trace tracking
│   │   └── index.js      # ExecutionLogger & PersistentLogger
│   ├── walrus/           # Decentralized storage client
│   │   └── client.js     # WalrusClient class
│   ├── demo/             # Demo implementations
│   │   ├── index.js      # Demo exports
│   │   ├── flight-demo.js # FlightDemo class
│   │   └── runner.js    # DemoRunner class
│   ├── utils/            # Shared utilities
│   │   └── parsers.js    # Goal parsing functions
│   ├── index.js          # Main entry point
│   └── demo-cli.js       # Demo CLI entry point
├── tests/
│   └── integration.test.js # Integration test suite
├── demo-flight.sh         # Quick demo script
├── test-demo-mock.js     # Mock data demo test
├── package.json
├── .env.example
├── README.md
├── OPENCLAW_INTEGRATION_COMPLETE.md  # Integration completion report
└── DAY3_VERIFICATION.md              # Day 3 verification
```

## 🔌 Sui & Walrus Integration

Mad Sniper integrates with Walrus decentralized storage on the Sui network for:

### What Gets Stored
1. **Task Definition**
   - Original goal
   - Parsed constraints
   - Execution plan

2. **Execution Trace**
   - All steps executed
   - Results at each step
   - Error information
   - Final output

### How It Works

```
Task Definition ──► Walrus Store ──► Blob ID
                                    │
                                    │ Retrieved via Blob ID
                                    ▼
Execution Trace ──► Walrus Store ──► Blob ID
```

### Provenance

Each demo execution produces two blob IDs:
- **Task Blob ID**: Unique identifier for the task definition
- **Trace Blob ID**: Unique identifier for the complete execution trace

These IDs can be used to retrieve and verify the exact execution that produced the results.

### Graceful Degradation

If Walrus storage is unavailable:
- Execution continues normally
- Results are still displayed
- Warning is shown about storage failure
- No impact on demo functionality

## 🧪 Testing

```bash
# Run integration tests
npm run test:integration

# Test Walrus connectivity
npm run test:storage

# Run demo with mock data (no LLM required)
node test-demo-mock.js
```

### Test Coverage

- ✅ Browser Controller (8 tests)
- ✅ Action Executor (7 tests)
- ✅ Walrus Client (8 tests)
- ✅ Persistent Logger (12 tests)
- ✅ Integration Flow (1 test)
- ✅ Mock Tests (5 tests)

**Total:** 41 tests

## 📊 Implementation Progress

### Day 1 ✅ Complete
- ✅ Project setup & structure
- ✅ Task Planner with LLM integration
- ✅ Execution Logger with state tracking
- ✅ Goal parsing utilities
- ✅ Basic goal → plan → log flow

### Day 2 ✅ Complete
- ✅ Browser Controller (OpenClaw wrapper)
- ✅ Action Executor with multi-step execution
- ✅ Walrus Client for decentralized storage
- ✅ Persistent Logger with Walrus integration
- ✅ Comprehensive integration tests

### Day 3 ✅ Complete
- ✅ Flight Demo (end-to-end implementation)
- ✅ Demo Runner with formatted output
- ✅ Quick demo script for judges
- ✅ Comprehensive documentation
- ✅ Full Walrus integration verified

### OpenClaw Integration ✅ Complete
- ✅ Browser tool bridge (`browser-tool.js`)
- ✅ Dynamic initialization support
- ✅ Mock fallback for standalone mode
- ✅ Multi-strategy element finding
- ✅ Comprehensive error handling
- ✅ Retry logic with exponential backoff
- ✅ All 41 integration tests passing
- ✅ Walrus storage with graceful degradation

**See:** [`OPENCLAW_INTEGRATION_COMPLETE.md`](./OPENCLAW_INTEGRATION_COMPLETE.md) for detailed implementation report

## 🛠️ Development

### Code Style

- ES Modules (`import`/`export`)
- Async/await throughout
- JSDoc comments for all public APIs
- Consistent error handling

### Adding New Demo Types

1. Create demo class in `src/demo/`:
```javascript
export class NewDemo {
  async run(goal) {
    // Implementation
  }
}
```

2. Register in DemoRunner:
```javascript
switch (type) {
  case 'new':
    results = await this.runNewDemo(goal);
    break;
}
```

## 📚 API Reference

### DemoRunner

```javascript
import { DemoRunner } from './src/demo/index.js';

const runner = new DemoRunner({
  verbose: true,
  mockData: true,
  interactive: false
});

const results = await runner.run('Find flights SFO→JFK');
```

### FlightDemo

```javascript
import { FlightDemo } from './src/demo/index.js';

const demo = new FlightDemo({
  mockData: true,
  verbose: false
});

const results = await demo.run('Find flights SFO→JFK');
console.log(results.formatted); // Top 3 flights
console.log(results.blobIds);   // Walrus IDs
```

## 🐛 Troubleshooting

### "OPENAI_API_KEY not set"
- Create `.env` file with your API key
- Copy from `.env.example` as template

### "Invalid model ID"
- Update `OPENAI_MODEL` in `.env`
- Try `gpt-3.5-turbo` or `gpt-4`

### Walrus Storage Fails
- This is expected in offline/limited networks
- Demo continues gracefully
- Check network connectivity for full features

### Demo Slow Performance
- LLM response time varies
- Mock mode is faster for testing: `node test-demo-mock.js`

## 📄 License

MIT License - see LICENSE file for details

## 🤝 Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📞 Support

For issues or questions:
- Open an issue on GitHub
- Check existing documentation
- Review test files for examples

---

**Built for the Autonomous Agents Hackathon** 🚀
