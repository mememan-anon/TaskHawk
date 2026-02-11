#!/usr/bin/env node

/**
 * Simple demo test using mock data (no LLM required)
 * This verifies the demo flow works correctly
 */

import { FlightDemo } from './src/demo/flight-demo.js';

async function testDemo() {
  console.log(`\n🎯 Testing Flight Demo with Mock Data...`);

  const demo = new FlightDemo({
    mockData: true,
    verbose: false
  });

  // Override the createPlan method to use a mock plan
  demo.createPlan = async () => {
    return {
      goalSummary: 'Find flights from SFO to JFK under $500',
      goalType: 'flight',
      constraints: {
        origin: 'SFO',
        destination: 'JFK',
        maxPrice: 500,
        timeframe: 'next week'
      },
      estimatedSteps: 3,
      totalSteps: 3,
      steps: [
        {
          id: 'step_1',
          name: 'Navigate to flight search',
          type: 'navigate',
          description: 'Navigate to flight search page',
          input: { url: 'https://example.com/flights' },
          expectedOutput: 'Flight search page loaded',
          dependencies: []
        },
        {
          id: 'step_2',
          name: 'Enter search criteria',
          type: 'fill_form',
          description: 'Fill flight search form',
          input: { origin: 'SFO', destination: 'JFK' },
          expectedOutput: 'Search form filled',
          dependencies: ['step_1']
        },
        {
          id: 'step_3',
          name: 'Extract results',
          type: 'extract',
          description: 'Extract flight options',
          input: {},
          expectedOutput: 'List of flights',
          dependencies: ['step_2']
        }
      ],
      createdAt: new Date().toISOString()
    };
  };

  try {
    const results = await demo.run('Find flights from SFO to JFK under $500');

    // Print flight results table
    console.log(`\n${'='.repeat(80)}`);
    console.log(`  FLIGHT SEARCH RESULTS — ${results.flights.length} flights found`);
    console.log(`  Goal: "${results.goal}"`);
    console.log(`  Duration: ${(results.duration / 1000).toFixed(2)}s`);
    console.log(`${'='.repeat(80)}\n`);

    results.flights.forEach((flight, i) => {
      console.log(`  #${i + 1}  ${flight.airline} ${flight.flightNumber}`);
      console.log(`      ${flight.origin} -> ${flight.destination}`);
      console.log(`      Depart: ${flight.departureTime}  |  Arrive: ${flight.arrivalTime}`);
      console.log(`      Duration: ${flight.duration}  |  Stops: ${flight.stops}`);
      console.log(`      Price: $${flight.price}  |  Aircraft: ${flight.aircraft}`);
      console.log(`  ${'-'.repeat(50)}`);
    });

    console.log(`\n  Validation: ${results.validation.isValid ? 'All constraints satisfied' : results.validation.issues.join(', ')}`);

    const aggregatorUrl = process.env.WALRUS_AGGREGATOR_URL || 'https://aggregator.walrus-testnet.walrus.space';

    if (results.storage.success) {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`  WALRUS DECENTRALIZED STORAGE (Sui Network)`);
      console.log(`${'='.repeat(80)}`);
      console.log(`\n  Task Blob ID:  ${results.storage.blobIds.task}`);
      console.log(`  Trace Blob ID: ${results.storage.blobIds.trace}`);
      console.log(`\n  View your data on Walrus (click or paste in browser):\n`);
      console.log(`  Task:  ${aggregatorUrl}/v1/blobs/${results.storage.blobIds.task}`);
      console.log(`  Trace: ${aggregatorUrl}/v1/blobs/${results.storage.blobIds.trace}`);
    } else {
      console.log(`\n  Storage: Walrus unavailable (results shown locally)`);
    }
    console.log();

    process.exit(0);
  } catch (error) {
    console.error(`\n❌ Demo test failed: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await demo.cleanup();
  }
}

testDemo();
