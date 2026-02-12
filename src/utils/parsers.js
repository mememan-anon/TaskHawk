/**
 * Goal Parsing Utilities
 *
 * Provides helper functions for parsing and analyzing natural language goals.
 */

// Map of city/country names and aliases to IATA airport codes
const LOCATION_TO_IATA = {
  // US cities
  'new york': 'JFK', 'nyc': 'JFK', 'manhattan': 'JFK',
  'los angeles': 'LAX', 'la': 'LAX',
  'san francisco': 'SFO', 'sf': 'SFO',
  'chicago': 'ORD',
  'atlanta': 'ATL',
  'dallas': 'DFW',
  'denver': 'DEN',
  'seattle': 'SEA',
  'miami': 'MIA',
  'boston': 'BOS',
  'houston': 'IAH',
  'phoenix': 'PHX',
  'minneapolis': 'MSP',
  'detroit': 'DTW',
  'orlando': 'MCO',
  'newark': 'EWR',
  'las vegas': 'LAS', 'vegas': 'LAS',
  'honolulu': 'HNL', 'hawaii': 'HNL',
  'portland': 'PDX',
  'washington': 'IAD', 'dc': 'IAD',
  // Europe
  'london': 'LHR', 'uk': 'LHR', 'england': 'LHR',
  'paris': 'CDG', 'france': 'CDG',
  'amsterdam': 'AMS', 'netherlands': 'AMS',
  'frankfurt': 'FRA', 'germany': 'FRA',
  'berlin': 'BER',
  'madrid': 'MAD', 'spain': 'MAD',
  'rome': 'FCO', 'italy': 'FCO',
  'istanbul': 'IST', 'turkey': 'IST', 'turkiye': 'IST',
  'dublin': 'DUB', 'ireland': 'DUB',
  'lisbon': 'LIS', 'portugal': 'LIS',
  'zurich': 'ZRH', 'switzerland': 'ZRH',
  // Middle East
  'dubai': 'DXB', 'uae': 'DXB',
  'doha': 'DOH', 'qatar': 'DOH',
  'abu dhabi': 'AUH',
  'riyadh': 'RUH', 'saudi arabia': 'RUH',
  // Africa
  'nairobi': 'NBO', 'kenya': 'NBO',
  'lagos': 'LOS', 'nigeria': 'LOS',
  'johannesburg': 'JNB', 'south africa': 'JNB',
  'cairo': 'CAI', 'egypt': 'CAI',
  'addis ababa': 'ADD', 'ethiopia': 'ADD',
  'accra': 'ACC', 'ghana': 'ACC',
  'casablanca': 'CMN', 'morocco': 'CMN',
  'dar es salaam': 'DAR', 'tanzania': 'DAR',
  'kampala': 'EBB', 'uganda': 'EBB', 'entebbe': 'EBB',
  'kigali': 'KGL', 'rwanda': 'KGL',
  'cape town': 'CPT',
  // Asia
  'tokyo': 'NRT', 'japan': 'NRT',
  'singapore': 'SIN',
  'hong kong': 'HKG',
  'bangkok': 'BKK', 'thailand': 'BKK',
  'mumbai': 'BOM', 'india': 'DEL',
  'delhi': 'DEL', 'new delhi': 'DEL',
  'beijing': 'PEK', 'china': 'PEK',
  'shanghai': 'PVG',
  'seoul': 'ICN', 'south korea': 'ICN', 'korea': 'ICN',
  'manila': 'MNL', 'philippines': 'MNL',
  'kuala lumpur': 'KUL', 'malaysia': 'KUL',
  'taipei': 'TPE', 'taiwan': 'TPE',
  'jakarta': 'CGK', 'indonesia': 'CGK',
  // Oceania
  'sydney': 'SYD', 'australia': 'SYD',
  'melbourne': 'MEL',
  'auckland': 'AKL', 'new zealand': 'AKL',
  // Americas
  'toronto': 'YYZ', 'canada': 'YYZ',
  'vancouver': 'YVR',
  'mexico city': 'MEX', 'mexico': 'MEX',
  'sao paulo': 'GRU', 'brazil': 'GRU',
  'buenos aires': 'EZE', 'argentina': 'EZE',
  'bogota': 'BOG', 'colombia': 'BOG',
  'lima': 'LIM', 'peru': 'LIM',
};

/**
 * Resolve a location string to an IATA airport code.
 * Returns the input uppercased if it's already a 3-letter code,
 * otherwise looks up the city/country name.
 */
function resolveAirportCode(location) {
  if (!location) return null;
  const trimmed = location.trim();

  // Already a 3-letter IATA code
  if (/^[A-Z]{3}$/i.test(trimmed)) {
    return trimmed.toUpperCase();
  }

  // Look up by name (case-insensitive)
  const key = trimmed.toLowerCase();
  if (LOCATION_TO_IATA[key]) {
    return LOCATION_TO_IATA[key];
  }

  // Try partial match for multi-word names (e.g. "new york city")
  for (const [name, code] of Object.entries(LOCATION_TO_IATA)) {
    if (key.includes(name) || name.includes(key)) {
      return code;
    }
  }

  // Return uppercased as-is (may still work for some routes)
  return trimmed.toUpperCase();
}

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
 *
 * parseConstraints("kenya to uganda under 100 dollars")
 * // Returns: { origin: "NBO", destination: "EBB", maxPrice: 100 }
 */
export function parseConstraints(goal) {
  const constraints = {};

  // Origin detection — "from X" (supports multi-word like "from New York")
  const fromMatch = goal.match(/from\s+([A-Za-z][A-Za-z\s]{1,20}?)(?:\s+to\s|\s+under\s|\s+below\s|\s+max\s|\s+next\s|\s+for\s|$)/i);
  if (fromMatch) {
    constraints.origin = resolveAirportCode(fromMatch[1]);
  }

  // Destination detection — "to X" (supports multi-word)
  const toMatch = goal.match(/(?:to|in)\s+([A-Za-z][A-Za-z\s]{1,20}?)(?:\s+under\s|\s+below\s|\s+max\s|\s+next\s|\s+for\s|\s+from\s|$)/i);
  if (toMatch) {
    constraints.destination = resolveAirportCode(toMatch[1]);
  }

  // Handle "X to Y" pattern (no "from") — e.g. "kenya to uganda under 100"
  if (!constraints.origin && constraints.destination) {
    const directMatch = goal.match(/^(?:find\s+)?(?:flights?\s+)?([A-Za-z][A-Za-z\s]{1,20}?)\s+to\s/i);
    if (directMatch) {
      constraints.origin = resolveAirportCode(directMatch[1]);
    }
  }

  // Price detection — "under $X", "below $X", "max $X", "X dollars"
  const priceMatch = goal.match(/(?:under|below|max|budget)\s+\$?(\d+)/i)
    || goal.match(/\$(\d+)/i)
    || goal.match(/(\d+)\s*dollars/i);
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
