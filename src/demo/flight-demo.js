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

// Dynamic import — Puppeteer is huge and not available on serverless platforms
async function loadFlightsBrowser() {
  const mod = await import('../executor/flights-browser.js');
  return mod.searchGoogleFlights;
}

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
    this.headless = options.headless !== undefined ? options.headless : true;

    // Execution mode: 'mock', 'api' (SerpApi), or 'browser' (Puppeteer)
    if (options.mode === 'api') {
      this.execMode = 'api';
    } else if (options.mockData === false || options.mode === 'browser') {
      this.execMode = 'browser';
    } else {
      this.execMode = 'mock';
    }
    // Keep legacy property for backward compat
    this.useMockData = this.execMode === 'mock';

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

    if (this.execMode === 'api') {
      this.debug('Using SerpApi (Google Flights API)');
      return await this.executeWithApi(constraints);
    } else if (this.execMode === 'browser') {
      this.debug('Executing with real browser (Google Flights)');
      return await this.executeWithRealBrowser(constraints);
    } else {
      this.debug('Using mock flight data');
      return await this.executeWithMockData(constraints);
    }
  }

  /**
   * Execute with real browser automation via Google Flights.
   * @private
   * @param {Object} constraints - Search constraints
   * @returns {Promise<Array>} Array of real flight options
   */
  async executeWithRealBrowser(constraints) {
    const origin = constraints.origin || 'SFO';
    const destination = constraints.destination || 'JFK';
    const maxPrice = constraints.maxPrice || null;

    console.log(`   🌐 Launching Chrome browser...`);
    console.log(`   🔍 Searching Google Flights: ${origin} → ${destination}`);

    const searchGoogleFlights = await loadFlightsBrowser();
    const result = await searchGoogleFlights({
      origin,
      destination,
      maxPrice,
      headless: this.headless,
      verbose: this.verbose
    });

    if (!result.success || result.flights.length === 0) {
      console.log(`   ⚠️  Real search returned no results, falling back to mock data`);
      return await this.executeWithMockData(constraints);
    }

    console.log(`   ✓ Found ${result.flights.length} real flights from Google`);
    if (result.screenshot) {
      console.log(`   📸 Screenshot: ${result.screenshot}`);
    }

    this.logger.logStep(
      { name: 'search_flights_real', type: 'extract' },
      { totalFound: result.allFlights.length, matchingConstraints: result.flights.length, source: 'google-flights-live' },
      'success'
    );

    return result.flights;
  }

  /**
   * Execute with SerpApi Google Flights API (real prices, no browser needed).
   * @private
   * @param {Object} constraints - Search constraints
   * @returns {Promise<Array>} Array of real flight options from API
   */
  async executeWithApi(constraints) {
    const origin = constraints.origin || 'SFO';
    const destination = constraints.destination || 'JFK';
    const maxPrice = constraints.maxPrice || null;

    console.log(`   🔌 Calling Google Flights API: ${origin} → ${destination}`);

    try {
      const { searchFlightsApi } = await import('../executor/flights-api.js');
      const result = await searchFlightsApi({
        origin,
        destination,
        maxPrice,
        verbose: this.verbose
      });

      if (!result.success || result.flights.length === 0) {
        console.log(`   ⚠️  API returned no results, falling back to mock data`);
        return await this.executeWithMockData(constraints);
      }

      console.log(`   ✓ Found ${result.flights.length} real flights via API`);

      if (result.priceInsights) {
        const pi = result.priceInsights;
        if (pi.lowest_price) console.log(`   💰 Lowest: $${pi.lowest_price} (${pi.price_level || 'unknown'} price level)`);
      }

      this.logger.logStep(
        { name: 'search_flights_api', type: 'extract' },
        { totalFound: result.allFlights.length, matchingConstraints: result.flights.length, source: 'serpapi-google-flights' },
        'success'
      );

      return result.flights;
    } catch (err) {
      console.log(`   ⚠️  API call failed: ${err.message}`);
      console.log(`   ⚠️  Falling back to mock data`);
      return await this.executeWithMockData(constraints);
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

    // Route-specific realistic pricing, airlines, and durations
    const routeData = {
      'SFO-JFK': { prices: [320, 350, 380, 420, 450], duration: '5h 30m', airlines: ['United', 'Delta', 'JetBlue', 'American', 'Alaska'] },
      'JFK-SFO': { prices: [310, 340, 370, 410, 440], duration: '6h 15m', airlines: ['Delta', 'United', 'JetBlue', 'American', 'Alaska'] },
      'SFO-LAX': { prices: [89, 110, 125, 140, 155], duration: '1h 25m', airlines: ['Southwest', 'United', 'Delta', 'American', 'JetBlue'] },
      'LAX-SFO': { prices: [85, 105, 120, 135, 150], duration: '1h 20m', airlines: ['Southwest', 'United', 'Delta', 'American', 'Alaska'] },
      'JFK-LHR': { prices: [640, 720, 780, 850, 920], duration: '7h 10m', airlines: ['British Airways', 'Virgin Atlantic', 'Delta', 'American', 'United'] },
      'LHR-JFK': { prices: [620, 700, 760, 830, 900], duration: '8h 20m', airlines: ['British Airways', 'Virgin Atlantic', 'Delta', 'American', 'United'] },
      'NBO-JFK': { prices: [850, 980, 1050, 1150, 1280], duration: '17h 45m', airlines: ['Kenya Airways', 'Ethiopian', 'Emirates', 'Turkish Airlines', 'Qatar Airways'] },
      'JFK-NBO': { prices: [830, 960, 1030, 1120, 1250], duration: '16h 30m', airlines: ['Kenya Airways', 'Ethiopian', 'Emirates', 'Turkish Airlines', 'Qatar Airways'] },
      'NBO-LHR': { prices: [620, 720, 780, 850, 950], duration: '8h 45m', airlines: ['Kenya Airways', 'British Airways', 'Ethiopian', 'Emirates', 'Qatar Airways'] },
      'LAX-LHR': { prices: [580, 680, 750, 820, 920], duration: '10h 30m', airlines: ['British Airways', 'Virgin Atlantic', 'American', 'Delta', 'United'] },
      'SFO-NRT': { prices: [750, 850, 920, 1050, 1180], duration: '11h 15m', airlines: ['ANA', 'Japan Airlines', 'United', 'Singapore Airlines', 'Korean Air'] },
      'JFK-CDG': { prices: [550, 650, 720, 800, 880], duration: '7h 30m', airlines: ['Air France', 'Delta', 'United', 'American', 'Lufthansa'] },
      'LAX-SYD': { prices: [900, 1050, 1180, 1300, 1450], duration: '15h 30m', airlines: ['Qantas', 'United', 'Delta', 'American', 'Air New Zealand'] },
      'JFK-DXB': { prices: [720, 850, 950, 1080, 1200], duration: '12h 30m', airlines: ['Emirates', 'Qatar Airways', 'Delta', 'United', 'Etihad'] },
      'NBO-EBB': { prices: [85, 120, 150, 180, 220], duration: '1h 10m', airlines: ['Kenya Airways', 'Uganda Airlines', 'Jambojet', 'FlySax', 'Ethiopian'] },
      'EBB-NBO': { prices: [80, 115, 145, 175, 210], duration: '1h 05m', airlines: ['Uganda Airlines', 'Kenya Airways', 'Jambojet', 'Ethiopian', 'RwandAir'] },
      'NBO-ADD': { prices: [180, 220, 260, 310, 380], duration: '2h 15m', airlines: ['Ethiopian', 'Kenya Airways', 'FlySax', 'Jambojet', 'RwandAir'] },
      'NBO-DAR': { prices: [90, 130, 160, 200, 250], duration: '1h 20m', airlines: ['Kenya Airways', 'Precision Air', 'FastJet', 'Ethiopian', 'RwandAir'] },
      'NBO-KGL': { prices: [120, 160, 200, 240, 290], duration: '1h 40m', airlines: ['Kenya Airways', 'RwandAir', 'Ethiopian', 'Jambojet', 'Uganda Airlines'] },
      'NBO-JNB': { prices: [350, 420, 480, 550, 640], duration: '4h 10m', airlines: ['Kenya Airways', 'South African', 'Ethiopian', 'Emirates', 'FlySafair'] },
      'NBO-LOS': { prices: [380, 450, 520, 600, 700], duration: '5h 30m', airlines: ['Kenya Airways', 'Ethiopian', 'Emirates', 'Turkish Airlines', 'RwandAir'] },
      'NBO-ACC': { prices: [340, 410, 470, 540, 630], duration: '5h 45m', airlines: ['Kenya Airways', 'Ethiopian', 'Emirates', 'Turkish Airlines', 'South African'] },
    };

    // Estimate route type for unknown routes
    const routeKey = `${origin}-${destination}`;
    let route = routeData[routeKey];

    if (!route) {
      // Detect if route is likely international or domestic based on common airport codes
      const domesticUS = ['SFO', 'JFK', 'LAX', 'ORD', 'ATL', 'DFW', 'DEN', 'SEA', 'MIA', 'BOS', 'IAH', 'EWR', 'LGA', 'PHX', 'MSP'];
      const isDomestic = domesticUS.includes(origin) && domesticUS.includes(destination);

      if (isDomestic) {
        route = { prices: [180, 220, 260, 310, 380], duration: '4h 15m', airlines: ['United', 'Delta', 'American', 'Southwest', 'JetBlue'] };
      } else {
        // International — realistic pricing
        route = { prices: [750, 880, 1020, 1150, 1300], duration: '12h 30m', airlines: ['United', 'Delta', 'Emirates', 'British Airways', 'Lufthansa'] };
      }
    }

    const flights = route.prices.slice(0, 5).map((price, idx) => ({
      airline: route.airlines[idx],
      flightNumber: `${route.airlines[idx].substring(0, 2).toUpperCase()}${1000 + Math.floor(Math.random() * 900)}`,
      origin,
      destination,
      departureTime: this.generateMockTime(idx),
      arrivalTime: this.generateMockTime(idx + parseInt(route.duration)),
      price: price,
      duration: route.duration,
      stops: idx < 2 ? 'Nonstop' : (idx < 4 ? '1 stop' : '2 stops'),
      aircraft: ['Boeing 787', 'Airbus A350', 'Boeing 777', 'Airbus A321', 'Boeing 737'][idx]
    }));

    // Filter by max price if a constraint was specified
    if (constraints.maxPrice) {
      const filteredFlights = flights.filter(f => f.price <= maxPrice);

      this.logger.logStep(
        { name: 'search_flights', type: 'extract' },
        { totalFound: flights.length, matchingConstraints: filteredFlights.length },
        filteredFlights.length > 0 ? 'success' : 'warning'
      );

      if (filteredFlights.length > 0) {
        return filteredFlights;
      }

      // No flights match the budget — return cheapest options sorted by price
      // and mark them so the frontend can show a "no exact match" notice
      const sorted = [...flights].sort((a, b) => a.price - b.price);
      return sorted.slice(0, 3);
    }

    this.logger.logStep(
      { name: 'search_flights', type: 'extract' },
      { totalFound: flights.length, matchingConstraints: flights.length },
      'success'
    );

    return flights;
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
