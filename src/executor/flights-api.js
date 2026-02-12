/**
 * Google Flights API Client (via SerpApi)
 *
 * Fetches real flight prices using SerpApi's Google Flights engine.
 * No browser needed — works on any platform including serverless.
 *
 * Get a free API key at https://serpapi.com (100 searches/month free).
 */

/**
 * Search for flights using SerpApi's Google Flights API.
 * @param {Object} options - Search options
 * @param {string} options.origin - Origin airport code (e.g., 'NBO')
 * @param {string} options.destination - Destination airport code (e.g., 'JFK')
 * @param {string} [options.date] - Departure date (YYYY-MM-DD). Defaults to 7 days from now.
 * @param {number} [options.maxPrice] - Maximum price filter
 * @param {string} [options.apiKey] - SerpApi API key (or set SERPAPI_KEY env var)
 * @param {boolean} [options.verbose=false] - Enable verbose logging
 * @returns {Promise<Object>} Search results with flights array and metadata
 */
export async function searchFlightsApi(options = {}) {
  const {
    origin,
    destination,
    date,
    maxPrice,
    apiKey,
    verbose = false
  } = options;

  const log = verbose ? (...args) => console.log('[FlightsAPI]', ...args) : () => {};

  const key = apiKey || process.env.SERPAPI_KEY;
  if (!key) {
    throw new Error('SerpApi key required. Set SERPAPI_KEY in .env or pass apiKey option.');
  }

  if (!origin || !destination) {
    throw new Error('Origin and destination airport codes are required.');
  }

  // Default date: 7 days from now
  const searchDate = date || getDefaultDate();

  log(`Searching: ${origin} -> ${destination} on ${searchDate}`);

  const params = new URLSearchParams({
    engine: 'google_flights',
    departure_id: origin,
    arrival_id: destination,
    outbound_date: searchDate,
    type: '2',        // One-way
    currency: 'USD',
    hl: 'en',
    gl: 'us',
    sort_by: '2',     // Sort by price
    api_key: key
  });

  const url = `https://serpapi.com/search?${params}`;
  log(`Calling SerpApi...`);

  const response = await fetch(url, { signal: AbortSignal.timeout(25000) });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`SerpApi request failed (${response.status}): ${text}`);
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(`SerpApi error: ${data.error}`);
  }

  // Parse best_flights and other_flights into our standard format
  const bestFlights = (data.best_flights || []).flatMap(f => parseFlightGroup(f, origin, destination));
  const otherFlights = (data.other_flights || []).flatMap(f => parseFlightGroup(f, origin, destination));
  const allFlights = [...bestFlights, ...otherFlights];

  log(`Found ${allFlights.length} flights (${bestFlights.length} best, ${otherFlights.length} other)`);

  // Filter by max price if specified
  let filtered = allFlights;
  if (maxPrice) {
    filtered = allFlights.filter(f => f.price <= maxPrice);
    log(`${filtered.length} flights under $${maxPrice}`);
  }

  const priceInsights = data.price_insights || null;

  return {
    success: true,
    flights: filtered.length > 0 ? filtered : allFlights.slice(0, 5),
    allFlights,
    priceInsights,
    query: { origin, destination, date: searchDate, maxPrice },
    source: 'serpapi-google-flights',
    timestamp: new Date().toISOString()
  };
}

/**
 * Parse a SerpApi flight group into our standard flight format.
 */
function parseFlightGroup(group, defaultOrigin, defaultDestination) {
  if (!group || !group.flights || group.flights.length === 0) return [];

  const firstLeg = group.flights[0];
  const lastLeg = group.flights[group.flights.length - 1];

  const stops = group.flights.length === 1
    ? 'Nonstop'
    : `${group.flights.length - 1} stop${group.flights.length > 2 ? 's' : ''}`;

  const totalMinutes = group.total_duration || 0;
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  const duration = `${hours}h ${mins}m`;

  const departTime = firstLeg.departure_airport?.time || '';
  const arriveTime = lastLeg.arrival_airport?.time || '';

  return [{
    airline: firstLeg.airline || 'Unknown',
    flightNumber: firstLeg.flight_number || '',
    origin: firstLeg.departure_airport?.id || defaultOrigin,
    destination: lastLeg.arrival_airport?.id || defaultDestination,
    departureTime: formatTime(departTime),
    arrivalTime: formatTime(arriveTime),
    price: group.price || 0,
    duration,
    stops,
    aircraft: firstLeg.airplane || '',
    layovers: (group.layovers || []).map(l => ({
      airport: l.name,
      code: l.id,
      duration: `${Math.floor(l.duration / 60)}h ${l.duration % 60}m`
    }))
  }];
}

/**
 * Format a datetime string like "2026-02-18 06:45" into "6:45 AM".
 */
function formatTime(datetimeStr) {
  if (!datetimeStr) return '';
  const timePart = datetimeStr.split(' ')[1];
  if (!timePart) return datetimeStr;

  const [h, m] = timePart.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${ampm}`;
}

/**
 * Get a default departure date (7 days from now).
 */
function getDefaultDate() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().split('T')[0];
}
