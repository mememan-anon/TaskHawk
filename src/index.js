#!/usr/bin/env node

/**
 * TaskHawk - Autonomous Web Task Orchestrator
 * Main Entry Point
 */

import { TaskPlanner } from './planner/index.js';
import { ExecutionLogger } from './logger/index.js';
import { DemoRunner } from './demo/index.js';
import { parseConstraints, detectGoalType, validateGoal } from './utils/parsers.js';
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
    dryRun: false,
    demo: false
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--goal' || args[i] === '-g') {
      parsed.goal = args[++i];
    } else if (args[i] === '--verbose' || args[i] === '-v') {
      parsed.verbose = true;
    } else if (args[i] === '--dry-run') {
      parsed.dryRun = true;
    } else if (args[i] === '--demo' || args[i] === '-d') {
      parsed.demo = true;
    }
  }

  return parsed;
}

/**
 * Run the demo mode with full execution and Walrus storage.
 * @async
 * @param {Object} args - Parsed command-line arguments
 */
async function runDemoMode(args) {
  console.log(`\n🎯 TaskHawk: Demo Mode`);
  console.log(`   Goal: "${args.goal}"`);

  try {
    const runner = new DemoRunner({
      verbose: args.verbose,
      mockData: true, // Use mock data for demo
      interactive: false
    });

    await runner.run(args.goal, { type: 'flight' });
    process.exit(0);
  } catch (error) {
    console.error(`\n❌ Demo failed: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Main execution function.
 * Orchestrates the full flow: goal → plan → log.
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
    console.log(`
╔═══════════════════════════════════════════════════════════════════╗
║  TASKHAWK - Autonomous Web Task Orchestrator                    ║
╠═══════════════════════════════════════════════════════════════════╣
║                                                                   ║
║  Usage:                                                           ║
║    node src/index.js --goal "Your goal here"                      ║
║    node src/index.js --demo --goal "Your goal here"               ║
║                                                                   ║
║  Examples:                                                        ║
║    node src/index.js --goal "Find flights from SFO to JFK"        ║
║    node src/index.js --demo --goal "Find flights from SFO to JFK" ║
║    npm test                                                       ║
║    ./demo-flight.sh                                               ║
║                                                                   ║
║  Options:                                                         ║
║    -g, --goal        The goal to accomplish                       ║
║    -d, --demo        Run in demo mode (full execution + Walrus)  ║
║    -v, --verbose     Enable verbose output                        ║
║    --dry-run         Plan without executing                       ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝
`);
    process.exit(0);
  }

  // If demo mode is requested, use DemoRunner
  if (args.demo) {
    await runDemoMode(args);
    return;
  }

  console.log(`\n🎯 TaskHawk: Starting execution`);
  console.log(`   Goal: "${args.goal}"`);
  console.log(`   Dry Run: ${args.dryRun ? 'Yes' : 'No'}`);

  try {
    // Initialize planner and logger
    const planner = new TaskPlanner({
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo'
    });

    const logger = new ExecutionLogger({
      sessionId: `exec_${Date.now()}`
    });

    logger.setGoal(args.goal);

    // Phase 1: Parse and analyze goal
    console.log(`\n📋 Phase 1: Analyzing goal...`);

    const goalType = detectGoalType(args.goal);
    const basicConstraints = parseConstraints(args.goal);
    const validation = validateGoal(args.goal);

    logger.logStep(
      { name: 'analyze_goal', type: 'validate' },
      { goalType, constraints: basicConstraints, validation },
      'success'
    );

    console.log(`   Type: ${goalType}`);
    console.log(`   Constraints: ${JSON.stringify(basicConstraints)}`);
    console.log(`   Valid: ${validation.isValid}`);

    if (!validation.isValid) {
      console.log(`   ⚠️  Missing info: ${validation.missing.join(', ')}`);
    }

    // Phase 2: Create execution plan using LLM
    console.log(`\n🧠 Phase 2: Creating execution plan...`);
    logger.setState('planning');

    const plan = await planner.createPlan(args.goal, {
      constraints: basicConstraints,
      type: goalType
    });

    // Validate the plan
    const planValidation = planner.validatePlan(plan);
    if (!planValidation.isValid) {
      throw new Error(`Invalid plan generated: ${planValidation.errors.join(', ')}`);
    }

    logger.logStep(
      { name: 'create_plan', type: 'planning' },
      { totalSteps: plan.totalSteps, goalSummary: plan.goalSummary },
      'success'
    );

    console.log(`   Plan created with ${plan.totalSteps} steps`);
    console.log(`   Summary: ${plan.goalSummary}`);
    console.log(`   Type: ${plan.goalType}`);

    if (args.verbose) {
      console.log(`\n   Plan Constraints:`);
      console.log(`   ${JSON.stringify(plan.constraints, null, 2)}`);
    }

    // Display the plan steps
    console.log(`\n   Execution Steps:`);
    plan.steps.forEach((step, idx) => {
      const deps = step.dependencies && step.dependencies.length > 0
        ? ` (deps: ${step.dependencies.join(', ')})`
        : '';
      console.log(`   [${idx + 1}/${plan.totalSteps}] ${step.name}: ${step.description}${deps}`);
    });

    // Phase 3: Log planning complete (execution coming in Day 2)
    console.log(`\n✅ Phase 3: Planning complete!`);

    logger.setState('completed');
    logger.setFinalResult({
      plan,
      steps: plan.steps.length,
      dryRun: args.dryRun
    });

    // In Day 2, we would execute the steps here
    if (args.dryRun) {
      console.log(`   (Dry run - skipping execution)`);
    } else {
      console.log(`   (Execution coming in Day 2!)`);
    }

    // Display the execution trace
    console.log(logger.formatTrace());

    // Display summary
    const summary = logger.getSummary();
    console.log(`📊 Summary:`);
    console.log(`   Status: ${summary.completed ? '✅ Completed' : '⚠️  Incomplete'}`);
    console.log(`   Steps planned: ${summary.totalSteps}`);
    console.log(`   Session: ${summary.sessionId}`);

    process.exit(0);

  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    if (process.env.DEBUG === 'true') {
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
