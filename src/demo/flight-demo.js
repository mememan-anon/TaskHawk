/**
 * Flight Demo Module
 *
 * End-to-end flight search demonstration.
 * Integrates planner, executor, logger, and Walrus storage.
 */

import { TaskPlanner } from '../planner/index.js';
import { ActionExecutor } from '../executor/index.js';
import { PersistentLogger } from '../logger/index.js';
import { parseConstraints, detectGoalType, validateGoal } from '../utils/parsers.js';

/**
 * FlightDemo class for demonstrating end-to-end flight search.
 * Orchestrates the complete workflow from goal to results.
 */
export class FlightDemo {
  /**
   * Create a new FlightDemo instance.
   * @param {Object} options - Configuration options
   * @param {string} [options.apiKey] - OpenAI API key
   * @param {string} [options.model] - Model to use
   * @param {boolean} [options.verbose=false] - Enable verbose logging
   * @param {boolean} [options.mockData=true] - Use mock flight data (true) or real browser (false)
   */
  constructor(options = {}) {
    this.apiKey = options.apiKey || process.env.OPENAI_API_KEY;
    this.model = options.model || process.env.OPENAI_MODEL || 'gpt-3.5-turbo';
    this.verbose = options.verbose || false;
    this.useMockData = options.mockData !== false; // Default to mock for demo

    // Initialize components
    this.planner = new TaskPlanner({
      apiKey: this.apiKey,
      model: this.model
    });

    this.logger = new PersistentLogger({
      verbose: this.verbose,
      autoStore: true,
      gracefulDegradation: true
    });

    this.executor = new ActionExecutor({
      verbose: this.verbose,
      logger: this.logger
    });

    this.results = null;
    this.storageIds = {
      task: null,
      trace: null
    };
  }

  /**
   * Log debug information if verbose mode is enabled.
   * @private
   * @param {string} message - Message to log
   * @param {any} [data] - Optional data to log
   */
  debug(message, data = null) {
    if (this.verbose) {
      if (data !== null) {
        console.log(`[FlightDemo] ${message}`, data);
      } else {
        console.log(`[FlightDemo] ${message}`);
      }
    }
  }

  /**
   * Parse and validate the goal.
   * @private
   * @param {string} goal - The flight search goal
   * @returns {Object} Parsed constraints and validation result
   */
  parseGoal(goal) {
    this.debug('Parsing goal:', goal);

    const constraints = parseConstraints(goal);
    const goalType = detectGoalType(goal);
    const validation = validateGoal(goal);

    this.debug('Parsed constraints:', constraints);
    this.debug('Goal type:', goalType);
    this.debug('Validation:', validation);

    this.logger.logStep(
      { name: 'parse_goal', type: 'parse' },
      { constraints, goalType, validation },
      validation.isValid ? 'success' : 'warning'
    );

    return { constraints, goalType, validation };
  }

  /**
   * Create execution plan using the planner.
   * @private
   * @param {string} goal - The flight search goal
   * @param {Object} constraints - Parsed constraints
   * @returns {Promise<Object>} Execution plan
   */
  async createPlan(goal, constraints) {
    this.debug('Creating execution plan...');

    this.logger.setState('planning');

    const plan = await this.planner.createPlan(goal, {
      constraints,
      type: 'flight'
    });

    // Validate the plan
    const planValidation = this.planner.validatePlan(plan);
    if (!planValidation.isValid) {
      throw new Error(`Invalid plan: ${planValidation.errors.join(', ')}`);
    }

    this.logger.logStep(
      { name: 'create_plan', type: 'planning' },
      { totalSteps: plan.totalSteps, goalSummary: plan.goalSummary },
      'success'
    );

    this.debug('Plan created with', plan.totalSteps, 'steps');
    return plan;
  }

  /**
   * Execute the plan to find flights.
   * @private
   * @param {Object} plan - Execution plan
   * @param {Object} constraints - Search constraints
   * @returns {Promise<Array>} Array of flight options
   */
  async executePlan(plan, constraints) {
    this.debug('Executing plan...');

    this.logger.setState('executing');

    if (this.useMockData) {
      // Use mock data for demo purposes
      this.debug('Using mock flight data');
      return await this.executeWithMockData(constraints);
    } else {
      // Execute with real browser
      this.debug('Executing with real browser');
      const result = await this.executor.executeSteps(plan.steps);
      return result;
    }
  }

  /**
   * Execute with mock flight data.
   * @private
   * @param {Object} constraints - Search constraints
   * @returns {Promise<Array>} Array of mock flight options
   */
  async executeWithMockData(constraints) {
    this.debug('Generating mock flight data for constraints:', constraints);

    // Simulate execution delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    const origin = constraints.origin || 'SFO';
    const destination = constraints.destination || 'JFK';
    const maxPrice = constraints.maxPrice || 1000;
    const timeframe = constraints.timeframe || 'next week';

    // Generate realistic mock flights
    const basePrices = {
      'SFO-JFK': [350, 420, 380, 450, 320],
      'SFO-LAX': [120, 150, 130, 140, 125],
      'JFK-LHR': [650, 720, 680, 750, 640],
      'default': [300, 350, 400, 280, 320]
    };

    const routeKey = `${origin}-${destination}`;
    const prices = basePrices[routeKey] || basePrices['default'];

    const flights = prices.slice(0, 5).map((price, idx) => ({
      airline: ['United', 'Delta', 'American', 'JetBlue', 'Southwest'][idx],
      flightNumber: `${['UA', 'DL', 'AA', 'B6', 'WN'][idx]}${1000 + Math.floor(Math.random() * 900)}`,
      origin,
      destination,
      departureTime: this.generateMockTime(idx),
      arrivalTime: this.generateMockTime(idx + 5),
      price: price,
      duration: '5h 30m',
      stops: Math.random() > 0.7 ? '1 stop' : 'Nonstop',
      aircraft: ['Boeing 737', 'Airbus A320', 'Boeing 777', 'Airbus A321', 'Boeing 787'][idx]
    }));

    // Filter by max price
    const filteredFlights = flights.filter(f => f.price <= maxPrice);

    this.logger.logStep(
      { name: 'search_flights', type: 'extract' },
      { totalFound: flights.length, matchingConstraints: filteredFlights.length },
      'success'
    );

    return filteredFlights.length > 0 ? filteredFlights : flights.slice(0, 3);
  }

  /**
   * Generate a mock time string.
   * @private
   * @param {number} offset - Hour offset from base time
   * @returns {string} Time string in format "HH:MM AM/PM"
   */
  generateMockTime(offset) {
    const baseHour = 6; // Start at 6 AM
    const hour = (baseHour + offset) % 24;
    const minute = Math.floor(Math.random() * 12) * 5; // 0, 5, 10, ..., 55
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minute.toString().padStart(2, '0')} ${ampm}`;
  }

  /**
   * Validate results against constraints.
   * @private
   * @param {Array} flights - Flight options to validate
   * @param {Object} constraints - Original constraints
   * @returns {Object} Validation result
   */
  validateResults(flights, constraints) {
    this.debug('Validating results against constraints...');

    const validation = {
      isValid: true,
      issues: [],
      flights: flights.length
    };

    // Check price constraints
    if (constraints.maxPrice) {
      const overBudget = flights.filter(f => f.price > constraints.maxPrice);
      if (overBudget.length > 0) {
        validation.isValid = false;
        validation.issues.push(`${overBudget.length} flights over max price`);
      }
    }

    // Check route matches
    if (constraints.origin && constraints.destination) {
      const wrongRoute = flights.filter(
        f => f.origin !== constraints.origin || f.destination !== constraints.destination
      );
      if (wrongRoute.length > 0) {
        validation.issues.push(`${wrongRoute.length} flights don't match route`);
      }
    }

    // Check if we have results
    if (flights.length === 0) {
      validation.isValid = false;
      validation.issues.push('No flights found');
    }

    this.logger.logStep(
      { name: 'validate_results', type: 'validate' },
      validation,
      validation.isValid ? 'success' : 'warning'
    );

    return validation;
  }

  /**
   * Store results to Walrus.
   * @private
   * @param {string} goal - Original goal
   * @param {Object} constraints - Search constraints
   * @param {Array} flights - Flight results
   * @returns {Promise<Object>} Storage result with blob IDs
   */
  async storeResults(goal, constraints, flights) {
    this.debug('Storing results to Walrus...');

    try {
      const taskId = `flight_demo_${Date.now()}`;

      // Store task definition
      const taskResult = await this.logger.storeTask(taskId, goal, {
        constraints,
        type: 'flight_search'
      });

      // Store execution trace
      const traceResult = await this.logger.storeTrace({
        flightsCount: flights.length,
        topFlight: flights[0] || null
      });

      this.storageIds.task = taskResult.blobId;
      this.storageIds.trace = traceResult.blobId;

      this.debug('Results stored successfully:', this.storageIds);

      return {
        success: true,
        taskId,
        blobIds: this.storageIds
      };

    } catch (error) {
      this.debug('Storage failed:', error.message);
      console.warn(`⚠️  Failed to store results to Walrus: ${error.message}`);
      return {
        success: false,
        error: error.message,
        blobIds: this.storageIds
      };
    }
  }

  /**
   * Format flight options for display.
   * @private
   * @param {Array} flights - Flight options
   * @param {number} limit - Maximum number of flights to format (default: 3)
   * @returns {Array} Formatted flight options
   */
  formatFlights(flights, limit = 3) {
    return flights.slice(0, limit).map((flight, idx) => ({
      rank: idx + 1,
      airline: flight.airline,
      flightNumber: flight.flightNumber,
      route: `${flight.origin} → ${flight.destination}`,
      departure: flight.departureTime,
      arrival: flight.arrivalTime,
      duration: flight.duration,
      stops: flight.stops,
      price: `$${flight.price}`,
      aircraft: flight.aircraft
    }));
  }

  /**
   * Run the complete flight demo.
   * @async
   * @param {string} goal - Flight search goal
   * @returns {Promise<Object>} Demo results
   * @throws {Error} If demo execution fails
   *
   * @example
   * const demo = new FlightDemo();
   * const results = await demo.run('Find flights from SFO to JFK under $500');
   * console.log(results.formatted);
   */
  async run(goal) {
    const startTime = Date.now();

    try {
      console.log(`\n🎯 Flight Demo: Starting execution`);
      console.log(`   Goal: "${goal}"`);
      console.log(`   Mode: ${this.useMockData ? 'Mock Data' : 'Real Browser'}`);

      this.logger.setGoal(goal);

      // Phase 1: Parse goal
      console.log(`\n📋 Phase 1: Analyzing goal...`);
      const { constraints, goalType, validation } = this.parseGoal(goal);

      if (!validation.isValid) {
        console.log(`   ⚠️  Missing info: ${validation.missing.join(', ')}`);
      } else {
        console.log(`   ✓ Origin: ${constraints.origin || 'Not specified'}`);
        console.log(`   ✓ Destination: ${constraints.destination || 'Not specified'}`);
        console.log(`   ✓ Max Price: ${constraints.maxPrice ? `$${constraints.maxPrice}` : 'Not specified'}`);
      }

      // Phase 2: Create plan
      console.log(`\n🧠 Phase 2: Creating execution plan...`);
      const plan = await this.createPlan(goal, constraints);

      console.log(`   ✓ Plan created with ${plan.totalSteps} steps`);
      console.log(`   ✓ Summary: ${plan.goalSummary}`);

      // Phase 3: Execute plan
      console.log(`\n⚡ Phase 3: Searching for flights...`);
      const flights = await this.executePlan(plan, constraints);

      console.log(`   ✓ Found ${flights.length} flight options`);

      // Phase 4: Validate results
      console.log(`\n✓ Phase 4: Validating results...`);
      const validation2 = this.validateResults(flights, constraints);

      if (validation2.isValid) {
        console.log(`   ✓ All constraints satisfied`);
      } else {
        console.log(`   ⚠️  Issues: ${validation2.issues.join(', ')}`);
      }

      // Phase 5: Store results
      console.log(`\n💾 Phase 5: Storing results...`);
      const storage = await this.storeResults(goal, constraints, flights);

      if (storage.success) {
        console.log(`   ✓ Task stored: ${storage.blobIds.task}`);
        console.log(`   ✓ Trace stored: ${storage.blobIds.trace}`);
      } else {
        console.log(`   ⚠️  Storage: ${storage.error || 'Failed'}`);
      }

      // Format top results
      console.log(`\n🎉 Phase 6: Formatting results...`);
      const formatted = this.formatFlights(flights, 3);

      // Store final result
      this.logger.setState('completed');
      this.logger.setFinalResult({
        flights,
        formatted,
        validation: validation2,
        storage,
        duration: Date.now() - startTime
      });

      this.results = {
        goal,
        constraints,
        flights,
        formatted,
        validation: validation2,
        storage,
        duration: Date.now() - startTime,
        blobIds: storage.blobIds,
        trace: this.logger.getTrace()
      };

      return this.results;

    } catch (error) {
      const duration = Date.now() - startTime;

      console.error(`\n❌ Demo failed: ${error.message}`);

      this.logger.logError(error, { goal, duration });

      throw new Error(`Flight demo execution failed: ${error.message}`);
    }
  }

  /**
   * Get the formatted flight results.
   * @returns {Array|null} Formatted flights or null if not run yet
   */
  getFormattedResults() {
    return this.results?.formatted || null;
  }

  /**
   * Get the Walrus blob IDs from the last run.
   * @returns {Object|null} Blob IDs or null if not run yet
   */
  getBlobIds() {
    return this.results?.blobIds || null;
  }

  /**
   * Get the execution trace.
   * @returns {Object|null} Execution trace or null if not run yet
   */
  getTrace() {
    return this.logger.getTrace();
  }

  /**
   * Cleanup resources.
   * @async
   * @returns {Promise<void>}
   */
  async cleanup() {
    this.debug('Cleaning up...');
    await this.executor.close();
  }
}

/**
 * Create a new FlightDemo instance with default options.
 * @param {Object} options - Configuration options
 * @returns {FlightDemo} New demo instance
 */
export function createFlightDemo(options = {}) {
  return new FlightDemo(options);
}

/**
 * Run a quick flight demo with default settings.
 * @async
 * @param {string} goal - Flight search goal
 * @param {Object} [options] - Optional configuration
 * @returns {Promise<Object>} Demo results
 *
 * @example
 * const results = await runFlightDemo('Find flights from SFO to JFK under $500');
 */
export async function runFlightDemo(goal, options = {}) {
  const demo = createFlightDemo(options);
  try {
    const results = await demo.run(goal);
    return results;
  } finally {
    await demo.cleanup();
  }
}
