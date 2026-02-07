# Day 2: Browser Automation Engine + Walrus Integration

## Overview

Day 2 implements the core execution engine for Mad Sniper, enabling automated web browsing and persistent storage of execution traces.

## Components Built

### 1. Browser Controller (`src/executor/browser.js`)

Wraps OpenClaw's browser tool for web automation with multi-strategy element finding.

**Features:**
- `navigate(url)` - Navigate to URLs
- `snapshot()` - Capture page state
- `click(selector)` - Click elements
- `type(selector, text)` - Input text
- `fillForm(fields)` - Fill multiple form fields
- Multi-strategy element finding (aria → role → text)
- Automatic retry logic
- Comprehensive error handling

**Example:**
```javascript
import { BrowserController } from './src/executor/browser.js';

const browser = new BrowserController({ verbose: true });
await browser.navigate('https://example.com');
await browser.type('Email', 'user@example.com');
await browser.click('Submit');
```

### 2. Action Executor (`src/executor/index.js`)

Executes steps from the execution plan with intelligent dispatching.

**Features:**
- `executeStep(step)` - Execute individual steps
- `executeSteps(steps)` - Execute step sequences
- `extractData(step)` - Extract data from pages
- Action dispatching (navigate, click, type, wait, extract, select, submit)
- Context management for step data
- Integration with BrowserController

**Example:**
```javascript
import { ActionExecutor } from './src/executor/index.js';

const executor = new ActionExecutor({ verbose: true });

await executor.executeStep({
  name: 'Navigate to search',
  type: 'navigate',
  params: { url: 'https://example.com/search' }
});

await executor.executeStep({
  name: 'Enter search query',
  type: 'type',
  params: { selector: 'Search', text: 'test query' }
});
```

### 3. Walrus Client (`src/walrus/client.js`)

Client for storing/retrieving data from Walrus decentralized storage.

**Features:**
- `store(data)` - Store data to Walrus
- `retrieve(blobId)` - Retrieve data by blob ID
- `storeTask(taskId, goal)` - Store task definitions
- `storeTrace(taskId, trace)` - Store execution traces
- Exponential backoff retry logic
- Connection testing

**API Endpoint:** `https://walrus-testnet.aggregator.staging.aws.sui.io/v1/`

**Example:**
```javascript
import { WalrusClient } from './src/walrus/client.js';

const client = new WalrusClient({ verbose: true });

// Store data
const result = await client.store({ task: 'example', data: 'test' });
console.log('Blob ID:', result.blobId);

// Retrieve data
const retrieved = await client.retrieve(result.blobId);
console.log('Data:', retrieved.data);
```

### 4. Persistent Logger (`src/logger/index.js` - Extended)

Extended ExecutionLogger with Walrus storage capabilities.

**New Features:**
- `storeTask(taskId, goal)` - Store task definitions to Walrus
- `storeTrace(metadata)` - Store execution traces to Walrus
- `retrieveTrace(blobId)` - Retrieve stored traces
- Graceful degradation if Walrus fails
- Storage metadata tracking
- Enhanced trace formatting with storage info

**Example:**
```javascript
import { PersistentLogger } from './src/logger/index.js';

const logger = new PersistentLogger({
  verbose: true,
  autoStore: true,
  gracefulDegradation: true
});

logger.setGoal('Find flights from NYC to London');
await logger.storeTask('task_123', 'Find flights from NYC to London');

// ... execute steps ...

logger.setState('completed'); // Auto-stores trace
```

### 5. Integration Tests (`tests/integration.test.js`)

Comprehensive test suite covering all components.

**Test Suites:**
- BrowserController (8 tests)
- ActionExecutor (7 tests)
- WalrusClient (8 tests)
- PersistentLogger (12 tests)
- Integration: Full Flow (1 test)
- Mock Tests for Demo (5 tests)

**Total:** 41 tests, all passing ✅

**Run tests:**
```bash
npm run test:integration
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Task Planner                           │
│                   (from Day 1)                              │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                   ActionExecutor                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  executeStep() → Dispatch to appropriate handler     │   │
│  └─────────────────────────────────────────────────────┘   │
└──────┬──────────────────────────────────────┬──────────────┘
       │                                      │
       ▼                                      ▼
┌──────────────────────┐         ┌──────────────────────┐
│  BrowserController    │         │  PersistentLogger     │
│                       │         │                      │
│  - navigate()         │         │  - storeTask()       │
│  - snapshot()         │◄────────┤  - storeTrace()      │
│  - click()            │         │  - graceful degrade   │
│  - type()             │         └──────────┬───────────┘
│  - fillForm()         │                    │
│  - findElement()      │                    ▼
└──────────────────────┘         ┌──────────────────────┐
         ▲                       │   WalrusClient       │
         │                       │                      │
         │                       │  - store()           │
         └───────────────────────│  - retrieve()        │
     OpenClaw Browser            │  - retry logic      │
                                 └──────────────────────┘
```

## Key Design Decisions

### 1. Multi-Strategy Element Finding
Elements can be found by:
- **Aria references** (most specific): `aria-button-submit`
- **Role + name** (semantic): "Submit button"
- **Text content** (fallback): Any matching text

This provides robustness across different page structures.

### 2. Retry Logic with Exponential Backoff
All browser and Walrus operations use configurable retry:
- Default: 3 retries
- Backoff: 1s, 2s, 4s (exponential)
- Timeout: 30s per request

### 3. Graceful Degradation
- If Walrus fails, execution continues
- Errors are logged but don't stop the workflow
- Storage errors are tracked and reported

### 4. Context Management
The ActionExecutor maintains a context object for sharing data between steps:
```javascript
executor.setContext('searchResults', results);
const results = executor.getContext();
```

## API Reference

### BrowserController

```javascript
new BrowserController(options)
// options: { profile, defaultTimeout, maxRetries, verbose }

await start()                          // Start browser session
await navigate(url, options)           // Navigate to URL
await snapshot(options)               // Take page snapshot
await click(selector, options)         // Click element
await type(selector, text, options)    // Type into input
await fillForm(fields)                // Fill multiple fields
await waitForElement(selector, opts)  // Wait for element
await wait(ms)                        // Sleep
await close()                          // Close browser
```

### ActionExecutor

```javascript
new ActionExecutor(options)
// options: { browserController, logger, verbose }

await executeStep(step)               // Execute single step
await executeSteps(steps)             // Execute step sequence
getContext()                          // Get context object
setContext(key, value)                // Set context value
clearContext()                        // Clear all context
await close()                         // Cleanup
```

### WalrusClient

```javascript
new WalrusClient(options)
// options: { apiUrl, maxRetries, retryDelay, timeout, verbose }

await store(data, options)            // Store data
await retrieve(blobId, options)       // Retrieve data
await exists(blobId)                  // Check if blob exists
await testConnectivity()              // Test API connection
await storeTask(taskId, goal, meta)   // Store task
await storeTrace(taskId, trace, meta) // Store trace
```

### PersistentLogger

```javascript
new PersistentLogger(options)
// options: { sessionId, walrusClient, walrusConfig, autoStore, gracefulDegradation, verbose }

await storeTask(taskId, goal, metadata)   // Store task
await storeTrace(metadata)                // Store trace
await retrieveTrace(blobId)               // Retrieve trace
getStorageInfo()                          // Get storage metadata
isPersisted()                             // Check if persisted
await testStorageConnectivity()          // Test storage
```

## Error Handling

All components follow consistent error handling patterns:

1. **Validation Errors** - Thrown synchronously for programming errors
2. **Execution Errors** - Wrapped in try-catch, return error results
3. **Network Errors** - Retried with exponential backoff
4. **Storage Errors** - Gracefully degraded when `gracefulDegradation` is true

## Testing

The test suite uses Node.js's built-in test runner with mocking for demo purposes.

### Running Tests

```bash
# Run all integration tests
npm run test:integration

# Test Walrus connectivity (requires network access)
npm run test:storage
```

### Test Coverage

- ✅ Browser wrapper functionality
- ✅ Multi-strategy element finding
- ✅ Action dispatching
- ✅ Walrus client with retry logic
- ✅ Persistent logger integration
- ✅ Error handling scenarios
- ✅ Full execution flow

## Usage Example

Complete example showing the full flow:

```javascript
import { ActionExecutor } from './src/executor/index.js';
import { PersistentLogger } from './src/logger/index.js';

// Initialize
const logger = new PersistentLogger({ verbose: true });
const executor = new ActionExecutor({ logger, verbose: true });

// Set up task
const taskId = 'task_flight_search';
const goal = 'Find flights from NYC to London';

logger.setGoal(goal);
await logger.storeTask(taskId, goal);

logger.setState('executing');

// Execute plan
const steps = [
  { name: 'Navigate', type: 'navigate', params: { url: 'https://example.com' } },
  { name: 'Enter origin', type: 'type', params: { selector: 'From', text: 'NYC' } },
  { name: 'Enter destination', type: 'type', params: { selector: 'To', text: 'London' } },
  { name: 'Submit', type: 'click', params: { selector: 'Search' } },
  { name: 'Wait for results', type: 'wait', params: { duration: 2000 } },
  { name: 'Extract results', type: 'extract', params: { selector: 'Price' } }
];

const result = await executor.executeSteps(steps);

// Complete
if (result.completed) {
  logger.setFinalResult({ flights: result.results });
} else {
  logger.logError(new Error('Execution failed'));
}

// Cleanup
await executor.close();

// Trace is auto-stored to Walrus
const storageInfo = logger.getStorageInfo();
console.log('Task Blob:', storageInfo.taskBlobId);
console.log('Trace Blob:', storageInfo.traceBlobId);
```

## Next Steps (Day 3)

Day 3 will implement:
- Real plan execution (planning → executing)
- Error recovery and retry strategies
- Dynamic plan adjustment based on execution results
- Result aggregation and formatting

## Troubleshooting

### Browser Not Starting
- Ensure OpenClaw browser tool is available
- Check profile name is valid

### Walrus Connection Failing
- Expected in restricted network environments
- Graceful degradation allows continued operation
- Use `testConnectivity()` to diagnose

### Element Not Found
- Try alternative selectors
- Check page load timing with `waitForElement()`
- Enable verbose mode for debugging

## Notes

- Browser stub (`browser-tool.js`) allows testing without actual OpenClaw environment
- All code uses ES modules (type: "module")
- JSDoc comments provide inline documentation
- Error messages are detailed for debugging
