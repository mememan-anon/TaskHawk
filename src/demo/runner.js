/**
 * Demo Runner Module
 *
 * Provides a high-level interface for running demonstrations.
 * Handles user interaction, progress display, and result formatting.
 */

import { FlightDemo } from './flight-demo.js';
import readline from 'readline';

/**
 * DemoRunner class for orchestrating demo executions.
 * Provides interactive prompts and formatted output.
 */
export class DemoRunner {
  /**
   * Create a new DemoRunner instance.
   * @param {Object} options - Configuration options
   * @param {boolean} [options.verbose=false] - Enable verbose output
   * @param {boolean} [options.mockData=true] - Use mock data for demos
   * @param {boolean} [options.interactive=true] - Enable interactive prompts
   */
  constructor(options = {}) {
    this.verbose = options.verbose || false;
    this.mockData = options.mockData !== false;
    this.interactive = options.interactive !== false;
    this.demos = {
      flight: null
    };
    this.currentResults = null;
  }

  /**
   * Display a progress indicator.
   * @private
   * @param {string} message - Progress message
   * @param {string} [status] - Optional status emoji
   */
  showProgress(message, status = '⏳') {
    console.log(`${status} ${message}`);
  }

  /**
   * Display an error message.
   * @private
   * @param {string} message - Error message
   */
  showError(message) {
    console.error(`❌ ${message}`);
  }

  /**
   * Display a success message.
   * @private
   * @param {string} message - Success message
   */
  showSuccess(message) {
    console.log(`✅ ${message}`);
  }

  /**
   * Display a warning message.
   * @private
   * @param {string} message - Warning message
   */
  showWarning(message) {
    console.warn(`⚠️  ${message}`);
  }

  /**
   * Display formatted flight results.
   * @param {Array} results - Formatted flight results
   * @param {Object} [metadata] - Additional metadata to display
   */
  displayResults(results, metadata = {}) {
    if (!results || results.length === 0) {
      this.showError('No results to display');
      return;
    }

    console.log(`\n╔═══════════════════════════════════════════════════════════════════╗`);
    console.log(`║  FLIGHT SEARCH RESULTS                                              ║`);
    console.log(`╠═══════════════════════════════════════════════════════════════════╣`);

    // Display metadata if available
    if (metadata.duration) {
      const durationSec = (metadata.duration / 1000).toFixed(2);
      console.log(`║ Duration: ${durationSec}s${' '.repeat(55)}║`);
    }

    if (metadata.flightsCount) {
      console.log(`║ Total Found: ${metadata.flightsCount} flights${' '.repeat(45)}║`);
    }

    console.log(`╠═══════════════════════════════════════════════════════════════════╣`);

    // Display each flight
    results.forEach((flight, idx) => {
      const rank = `#${flight.rank}`;
      const airline = flight.airline.padEnd(15);
      const flightNum = flight.flightNumber.padEnd(8);
      const route = flight.route.padEnd(14);
      const time = `${flight.departure} → ${flight.arrival}`.padEnd(19);
      const price = flight.price.padEnd(8);
      const stops = flight.stops.padEnd(10);

      const line = `║ [${rank}] ${airline} ${flightNum} ${route} ${time} ${price} ${stops}  ║`;
      console.log(line);

      // Additional details on next line
      if (idx < results.length - 1) {
        console.log(`║      Aircraft: ${flight.aircraft}${' '.repeat(47)}║`);
        console.log(`╠───────────────────────────────────────────────────────────────────╣`);
      } else {
        console.log(`║      Aircraft: ${flight.aircraft}${' '.repeat(47)}║`);
      }
    });

    console.log(`╚═══════════════════════════════════════════════════════════════════╝\n`);

    // Display summary
    if (results.length > 0) {
      const cheapest = results.reduce((min, f) => f.price < min.price ? f : min);
      console.log(`💡 Best Deal: ${cheapest.airline} ${cheapest.flightNumber} - ${cheapest.price}`);
    }
  }

  /**
   * Display Walrus blob IDs for provenance.
   * @param {Object} blobIds - Object containing task and trace blob IDs
   * @param {Object} [metadata] - Additional metadata
   */
  displayProvenance(blobIds, metadata = {}) {
    const aggregatorUrl = process.env.WALRUS_AGGREGATOR_URL || 'https://aggregator.walrus-testnet.walrus.space';

    console.log(`\n${'='.repeat(80)}`);
    console.log(`  WALRUS DECENTRALIZED STORAGE (Sui Network)`);
    console.log(`${'='.repeat(80)}`);

    if (blobIds.task) {
      console.log(`\n  Task Blob ID:  ${blobIds.task}`);
    } else {
      console.log(`\n  Task Blob ID:  (not stored)`);
    }

    if (blobIds.trace) {
      console.log(`  Trace Blob ID: ${blobIds.trace}`);
    } else {
      console.log(`  Trace Blob ID: (not stored)`);
    }

    console.log(`\n  View your data on Walrus (click or paste in browser):\n`);

    if (blobIds.task) {
      console.log(`  Task:  ${aggregatorUrl}/v1/blobs/${blobIds.task}`);
    }
    if (blobIds.trace) {
      console.log(`  Trace: ${aggregatorUrl}/v1/blobs/${blobIds.trace}`);
    }

    console.log();
  }

  /**
   * Display execution trace summary.
   * @param {Object} trace - Execution trace object
   */
  displayTraceSummary(trace) {
    console.log(`\n📊 Execution Summary:`);
    console.log(`   Session: ${trace.sessionId}`);
    console.log(`   State: ${trace.state}`);
    console.log(`   Start: ${trace.startTime}`);
    console.log(`   End: ${trace.endTime || 'Running...'}`);
    console.log(`   Steps: ${trace.steps.length}`);

    if (trace.storage && (trace.storage.taskBlobId || trace.storage.traceBlobId)) {
      console.log(`   Storage: ✅ Persisted to Walrus`);
    } else {
      console.log(`   Storage: ⚠️  Not persisted`);
    }
  }

  /**
   * Prompt user for input (interactive mode).
   * @private
   * @param {string} question - Question to ask
   * @returns {Promise<string>} User input
   */
  async prompt(question) {
    if (!this.interactive) {
      return '';
    }

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise(resolve => {
      rl.question(question, answer => {
        rl.close();
        resolve(answer.trim());
      });
    });
  }

  /**
   * Run a demo with the given goal.
   * @async
   * @param {string} goal - Demo goal to execute
   * @param {Object} [options] - Execution options
   * @param {string} [options.type='flight'] - Demo type
   * @returns {Promise<Object>} Demo results
   * @throws {Error} If demo execution fails
   *
   * @example
   * const runner = new DemoRunner();
   * const results = await runner.run('Find flights from SFO to JFK under $500');
   */
  async run(goal, options = {}) {
    const type = options.type || 'flight';

    try {
      console.log(`\n${'='.repeat(71)}`);
      console.log(`  TASKHAWK - DEMO RUNNER`);
      console.log(`${'='.repeat(71)}`);

      if (!goal) {
        goal = await this.prompt('\nEnter your goal (e.g., "Find flights from SFO to JFK under $500"): ');
        if (!goal) {
          this.showError('No goal provided. Exiting.');
          process.exit(1);
        }
      }

      // Run the appropriate demo
      let results;

      switch (type) {
        case 'flight':
          results = await this.runFlightDemo(goal);
          break;
        default:
          throw new Error(`Unknown demo type: ${type}`);
      }

      this.currentResults = results;

      // Display results
      this.displayResults(results.formatted, {
        duration: results.duration,
        flightsCount: results.flights.length
      });

      // Display provenance
      if (results.storage && results.storage.success) {
        this.displayProvenance(results.storage.blobIds);
      }

      // Display trace summary
      if (results.trace) {
        this.displayTraceSummary(results.trace);
      }

      return results;

    } catch (error) {
      this.showError(`Demo execution failed: ${error.message}`);
      if (this.verbose) {
        console.error(error.stack);
      }
      throw error;
    }
  }

  /**
   * Run a flight-specific demo.
   * @private
   * @param {string} goal - Flight search goal
   * @returns {Promise<Object>} Flight demo results
   */
  async runFlightDemo(goal) {
    const demo = new FlightDemo({
      verbose: this.verbose,
      mockData: this.mockData
    });

    try {
      this.showProgress('Initializing Flight Demo...');
      const results = await demo.run(goal);
      return results;
    } finally {
      await demo.cleanup();
    }
  }

  /**
   * Run multiple demo scenarios.
   * @async
   * @param {Array<string>} goals - Array of goals to run
   * @param {Object} [options] - Execution options
   * @returns {Promise<Array<Object>>} Array of results
   */
  async runMultiple(goals, options = {}) {
    const allResults = [];

    console.log(`\n🚀 Running ${goals.length} demo scenarios...\n`);

    for (let i = 0; i < goals.length; i++) {
      const goal = goals[i];
      console.log(`\n${'─'.repeat(50)}`);
      console.log(`Scenario ${i + 1}/${goals.length}`);
      console.log(`${'─'.repeat(50)}\n`);

      try {
        const results = await this.run(goal, options);
        allResults.push({
          success: true,
          goal,
          results
        });
      } catch (error) {
        allResults.push({
          success: false,
          goal,
          error: error.message
        });
        this.showError(`Scenario ${i + 1} failed: ${error.message}`);
      }

      // Brief pause between scenarios
      if (i < goals.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Display summary
    this.displayMultiRunSummary(allResults);

    return allResults;
  }

  /**
   * Display summary of multiple demo runs.
   * @private
   * @param {Array<Object>} results - Array of run results
   */
  displayMultiRunSummary(results) {
    const successful = results.filter(r => r.success).length;
    const failed = results.length - successful;

    console.log(`\n${'='.repeat(71)}`);
    console.log(`  BATCH RUN SUMMARY`);
    console.log(`${'='.repeat(71)}`);
    console.log(`Total Scenarios: ${results.length}`);
    console.log(`✅ Successful: ${successful}`);
    console.log(`❌ Failed: ${failed}`);

    if (failed > 0) {
      console.log(`\nFailed Scenarios:`);
      results.filter(r => !r.success).forEach((r, idx) => {
        console.log(`  ${idx + 1}. ${r.goal}`);
        console.log(`     Error: ${r.error}`);
      });
    }

    console.log(`${'='.repeat(71)}\n`);
  }

  /**
   * Get current results.
   * @returns {Object|null} Current results or null
   */
  getCurrentResults() {
    return this.currentResults;
  }
}

/**
 * Create a new DemoRunner instance with default options.
 * @param {Object} options - Configuration options
 * @returns {DemoRunner} New runner instance
 */
export function createDemoRunner(options = {}) {
  return new DemoRunner(options);
}

/**
 * Quick function to run a demo from command line.
 * @async
 * @param {string} goal - Demo goal
 * @param {Object} [options] - Optional configuration
 * @returns {Promise<Object>} Demo results
 *
 * @example
 * // From command line
 * const results = await runDemo('Find flights from SFO to JFK under $500');
 */
export async function runDemo(goal, options = {}) {
  const runner = new DemoRunner(options);
  return await runner.run(goal, options);
}
