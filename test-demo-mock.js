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
    verbose: true
  });

  // Override the createPlan method to use a mock plan
  const originalCreatePlan = demo.createPlan.bind(demo);
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

    console.log(`\n✅ Demo test successful!`);
    console.log(`   Found ${results.flights.length} flights`);
    console.log(`   Duration: ${(results.duration / 1000).toFixed(2)}s`);

    if (results.storage.success) {
      console.log(`   ✅ Task stored: ${results.storage.blobIds.task}`);
      console.log(`   ✅ Trace stored: ${results.storage.blobIds.trace}`);
    } else {
      console.log(`   ⚠️  Storage: ${results.storage.error || 'Failed'}`);
    }

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
