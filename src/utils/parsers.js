/**
 * Goal Parsing Utilities
 *
 * Provides helper functions for parsing and analyzing natural language goals.
 */

/**
 * Extract constraints from a goal string.
 * Basic constraint detection for flight search and similar tasks.
 *
 * @param {string} goal - The natural language goal to analyze
 * @returns {Object} Parsed constraints object
 *
 * @example
 * parseConstraints("Find flights from SFO to JFK under $500")
 * // Returns: { origin: "SFO", destination: "JFK", maxPrice: 500 }
 */
export function parseConstraints(goal) {
  const constraints = {};

  // Origin detection (from X)
  const fromMatch = goal.match(/from\s+([A-Za-z]{3,}|[A-Z]{3})/i);
  if (fromMatch) {
    constraints.origin = fromMatch[1].toUpperCase();
  }

  // Destination detection (to X, in X)
  const toMatch = goal.match(/(?:to|in)\s+([A-Za-z]{3,}|[A-Z]{3})/i);
  if (toMatch) {
    constraints.destination = toMatch[1].toUpperCase();
  }

  // Price detection (under X, below X, max X)
  const priceMatch = goal.match(/(?:under|below|max)\s+\$?(\d+)/i);
  if (priceMatch) {
    constraints.maxPrice = parseInt(priceMatch[1], 10);
  }

  // Date/time detection (next week, tomorrow, today)
  const dateMatch = goal.match(/next week|tomorrow|today|this week/i);
  if (dateMatch) {
    constraints.timeframe = dateMatch[0].toLowerCase();
  }

  return constraints;
}

/**
 * Normalize goal text by removing extra whitespace and standardizing format.
 *
 * @param {string} goal - The goal to normalize
 * @returns {string} Normalized goal
 */
export function normalizeGoal(goal) {
  return goal
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s\-.,?!']/g, '');
}

/**
 * Detect goal type based on keywords.
 * Returns the most likely domain of the goal.
 *
 * @param {string} goal - The goal to analyze
 * @returns {string} Goal type (flight, hotel, general, etc.)
 */
export function detectGoalType(goal) {
  const lowerGoal = goal.toLowerCase();

  if (lowerGoal.includes('flight') || lowerGoal.includes('fly') || lowerGoal.includes('airport')) {
    return 'flight';
  }
  if (lowerGoal.includes('hotel') || lowerGoal.includes('stay') || lowerGoal.includes('accommodat')) {
    return 'hotel';
  }
  if (lowerGoal.includes('restaurant') || lowerGoal.includes('food') || lowerGoal.includes('eat')) {
    return 'restaurant';
  }

  return 'general';
}

/**
 * Validate that a goal contains required information.
 *
 * @param {string} goal - The goal to validate
 * @returns {Object} Validation result with isValid flag and missing fields
 */
export function validateGoal(goal) {
  const missing = [];
  const type = detectGoalType(goal);

  if (type === 'flight') {
    const constraints = parseConstraints(goal);
    if (!constraints.origin) missing.push('origin');
    if (!constraints.destination) missing.push('destination');
  }

  return {
    isValid: missing.length === 0,
    missing,
    type
  };
}
