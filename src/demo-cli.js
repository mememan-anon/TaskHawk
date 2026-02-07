#!/usr/bin/env node

/**
 * Mad Sniper - Demo CLI Entry Point
 *
 * This is the main entry point for running demos with formatted output.
 */

import { DemoRunner } from './demo/index.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Parse command-line arguments.
 * @returns {Object} Parsed arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {
    goal: null,
    verbose: false,
    type: 'flight',
    mockData: true
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--goal' || args[i] === '-g') {
      parsed.goal = args[++i];
    } else if (args[i] === '--verbose' || args[i] === '-v') {
      parsed.verbose = true;
    } else if (args[i] === '--type' || args[i] === '-t') {
      parsed.type = args[++i];
    } else if (args[i] === '--no-mock') {
      parsed.mockData = false;
    } else if (args[i] === '--help' || args[i] === '-h') {
      showUsage();
      process.exit(0);
    }
  }

  return parsed;
}

/**
 * Display usage information.
 */
function showUsage() {
  console.log(`
╔═══════════════════════════════════════════════════════════════════╗
║  MAD SNIPER - DEMO MODE                                           ║
╠═══════════════════════════════════════════════════════════════════╣
║                                                                   ║
║  Usage:                                                           ║
║    node src/demo-cli.js --goal "Your goal here"                   ║
║    ./demo-flight.sh "Your goal here"                              ║
║                                                                   ║
║  Examples:                                                        ║
║    node src/demo-cli.js -g "Find flights from SFO to JFK under $500"║
║    node src/demo-cli.js -g "Search flights NYC to London" -v      ║
║                                                                   ║
║  Options:                                                         ║
║    -g, --goal        The goal to accomplish (required)           ║
║    -t, --type        Demo type (flight, hotel, etc.)             ║
║    -v, --verbose     Enable verbose output                        ║
║    --no-mock         Use real browser instead of mock data        ║
║    -h, --help        Show this help message                       ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝
`);
}

/**
 * Main execution function.
 */
async function main() {
  const args = parseArgs();

  // Check if OPENAI_API_KEY is set
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ Error: OPENAI_API_KEY environment variable is not set.');
    console.error('   Create a .env file with your API key, or set it in your environment.');
    console.error('   See .env.example for reference.');
    process.exit(1);
  }

  // If no goal provided, show usage
  if (!args.goal) {
    showUsage();
    console.error('\n❌ Error: --goal is required');
    process.exit(1);
  }

  try {
    const runner = new DemoRunner({
      verbose: args.verbose,
      mockData: args.mockData,
      interactive: false
    });

    await runner.run(args.goal, { type: args.type });
    process.exit(0);
  } catch (error) {
    console.error(`\n❌ Demo failed: ${error.message}`);
    if (args.verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run the main function
main().catch(error => {
  console.error(`\n💥 Unhandled error: ${error.message}`);
  console.error(error.stack);
  process.exit(1);
});
