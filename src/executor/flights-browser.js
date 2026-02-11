/**
 * Google Flights Scraper
 *
 * Uses Puppeteer to perform real browser automation on Google Flights.
 * Navigates to the site, fills search forms, and extracts real flight data.
 */

import puppeteer from 'puppeteer';

/**
 * Search for flights on Google Flights using real browser automation.
 * @param {Object} options - Search options
 * @param {string} options.origin - Origin airport code (e.g., 'SFO')
 * @param {string} options.destination - Destination airport code (e.g., 'JFK')
 * @param {string} [options.date] - Departure date (YYYY-MM-DD). Defaults to 7 days from now.
 * @param {number} [options.maxPrice] - Maximum price filter
 * @param {boolean} [options.headless=false] - Run browser in headless mode
 * @param {boolean} [options.verbose=false] - Enable verbose logging
 * @returns {Promise<Object>} Search results with flights array and metadata
 */
export async function searchGoogleFlights(options = {}) {
  const {
    origin,
    destination,
    date,
    maxPrice,
    headless = false,
    verbose = false
  } = options;

  const log = verbose ? (...args) => console.log('[GoogleFlights]', ...args) : () => {};

  if (!origin || !destination) {
    throw new Error('Origin and destination are required');
  }

  // Default date: 7 days from now
  const searchDate = date || getDefaultDate();

  log(`Searching: ${origin} -> ${destination} on ${searchDate}`);

  let browser;
  try {
    // Launch real Chrome browser
    log('Launching Chrome...');
    browser = await puppeteer.launch({
      headless: headless ? 'new' : false,
      defaultViewport: { width: 1280, height: 900 },
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--window-size=1280,900'
      ]
    });

    const page = await browser.newPage();

    // Set a realistic user agent
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    );

    // Build Google Flights URL with parameters
    const url = buildFlightsUrl(origin, destination, searchDate);
    log(`Navigating to: ${url}`);

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // Handle cookie consent if it appears
    await dismissCookieConsent(page, log);

    // Wait for flight results to load
    log('Waiting for flight results...');
    await waitForResults(page, log);

    // Extract flight data from the page
    log('Extracting flight data...');
    const flights = await extractFlights(page, origin, destination, log);

    log(`Found ${flights.length} flights`);

    // Filter by max price if specified
    let filtered = flights;
    if (maxPrice) {
      filtered = flights.filter(f => f.price <= maxPrice);
      log(`${filtered.length} flights under $${maxPrice}`);
    }

    // Take a screenshot for proof
    const screenshotPath = `flight-search-${origin}-${destination}-${Date.now()}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: false });
    log(`Screenshot saved: ${screenshotPath}`);

    return {
      success: true,
      flights: filtered.length > 0 ? filtered : flights.slice(0, 5),
      allFlights: flights,
      query: { origin, destination, date: searchDate, maxPrice },
      screenshot: screenshotPath,
      source: 'google-flights-live',
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    log(`Error: ${error.message}`);
    return {
      success: false,
      flights: [],
      error: error.message,
      query: { origin, destination, date: searchDate, maxPrice },
      source: 'google-flights-live',
      timestamp: new Date().toISOString()
    };
  } finally {
    if (browser) {
      await browser.close();
      log('Browser closed');
    }
  }
}

/**
 * Build Google Flights URL with search parameters.
 */
function buildFlightsUrl(origin, destination, date) {
  // Google Flights URL format: /travel/flights/origin-destination/date
  return `https://www.google.com/travel/flights?q=flights+from+${origin}+to+${destination}+on+${date}&curr=USD`;
}

/**
 * Get a default departure date (7 days from now).
 */
function getDefaultDate() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().split('T')[0];
}

/**
 * Dismiss cookie consent dialog if present.
 */
async function dismissCookieConsent(page, log) {
  try {
    const consentButton = await page.$('button[aria-label="Accept all"]');
    if (consentButton) {
      await consentButton.click();
      log('Cookie consent dismissed');
      await page.waitForTimeout(1000);
    }
  } catch {
    // No consent dialog, continue
  }
}

/**
 * Wait for flight results to appear on the page.
 */
async function waitForResults(page, log) {
  const selectors = [
    'li[class*="pIav2d"]',     // Flight result items
    '[data-ved] li',           // Generic result items
    '.gws-flights-results__result-item', // Old format
    'ul[class*="Rk10dc"] li',  // Flight list items
    '[jsname="IWWDBc"]',       // Flight cards
    'div[class*="yR1fYc"]',    // Price elements
    '[data-price]'             // Price data attributes
  ];

  for (const selector of selectors) {
    try {
      await page.waitForSelector(selector, { timeout: 8000 });
      log(`Results found with selector: ${selector}`);
      return;
    } catch {
      continue;
    }
  }

  // Final fallback: just wait for the page to settle
  log('Using time-based wait for results...');
  await new Promise(r => setTimeout(r, 5000));
}

/**
 * Extract flight data from the Google Flights page.
 */
async function extractFlights(page, origin, destination, log) {
  const flights = await page.evaluate((orig, dest) => {
    const results = [];

    // Strategy 1: Look for flight list items with structured data
    const listItems = document.querySelectorAll('li');
    for (const item of listItems) {
      const text = item.innerText || '';

      // Look for items that contain flight-like data (price, airline, time)
      const priceMatch = text.match(/\$[\d,]+/);
      const timeMatch = text.match(/\d{1,2}:\d{2}\s*(?:AM|PM)/gi);
      const durationMatch = text.match(/(\d+)\s*hr?\s*(\d+)?\s*min/i) ||
                            text.match(/(\d+)h\s*(\d+)?m?/i);

      if (priceMatch && timeMatch && timeMatch.length >= 2) {
        const price = parseInt(priceMatch[0].replace(/[$,]/g, ''));
        const airline = extractAirline(text);
        const stops = text.toLowerCase().includes('nonstop') ? 'Nonstop' :
                     text.toLowerCase().includes('1 stop') ? '1 stop' :
                     text.toLowerCase().includes('2 stop') ? '2 stops' : 'Unknown';
        const duration = durationMatch ?
          `${durationMatch[1]}h ${durationMatch[2] || '0'}m` : 'Unknown';

        if (price > 0 && price < 50000) {
          results.push({
            airline: airline || 'Unknown',
            flightNumber: '',
            origin: orig,
            destination: dest,
            departureTime: timeMatch[0],
            arrivalTime: timeMatch[1] || '',
            price,
            duration,
            stops,
            aircraft: ''
          });
        }
      }
    }

    // Strategy 2: Look for price elements directly
    if (results.length === 0) {
      const priceElements = document.querySelectorAll('[data-price], span[aria-label*="dollar"], span[aria-label*="USD"]');
      for (const el of priceElements) {
        const priceText = el.getAttribute('data-price') || el.innerText;
        const price = parseInt((priceText || '').replace(/[$,]/g, ''));
        if (price > 0 && price < 50000) {
          const parent = el.closest('li') || el.closest('div[role="listitem"]') || el.parentElement?.parentElement;
          const fullText = parent ? parent.innerText : '';
          const timeMatch = fullText.match(/\d{1,2}:\d{2}\s*(?:AM|PM)/gi);
          const airline = extractAirline(fullText);

          results.push({
            airline: airline || 'Unknown',
            flightNumber: '',
            origin: orig,
            destination: dest,
            departureTime: timeMatch?.[0] || '',
            arrivalTime: timeMatch?.[1] || '',
            price,
            duration: '',
            stops: '',
            aircraft: ''
          });
        }
      }
    }

    // Strategy 3: Extract all visible prices from the page as last resort
    if (results.length === 0) {
      const allText = document.body.innerText;
      const allPrices = [...allText.matchAll(/\$([\d,]+)/g)].map(m => parseInt(m[1].replace(',', '')));
      const flightPrices = allPrices.filter(p => p >= 50 && p <= 20000);
      const uniquePrices = [...new Set(flightPrices)].slice(0, 10);

      for (const price of uniquePrices) {
        results.push({
          airline: 'Unknown',
          flightNumber: '',
          origin: orig,
          destination: dest,
          departureTime: '',
          arrivalTime: '',
          price,
          duration: '',
          stops: '',
          aircraft: ''
        });
      }
    }

    // Deduplicate by price
    const seen = new Set();
    return results.filter(f => {
      const key = `${f.price}-${f.departureTime}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 10);

    function extractAirline(text) {
      const airlines = [
        'United', 'Delta', 'American', 'JetBlue', 'Southwest', 'Alaska',
        'Spirit', 'Frontier', 'Hawaiian', 'Sun Country', 'Allegiant',
        'British Airways', 'Lufthansa', 'Air France', 'KLM', 'Emirates',
        'Qatar Airways', 'Turkish Airlines', 'Kenya Airways', 'Ethiopian',
        'LATAM', 'Avianca', 'Copa', 'Iberia', 'Virgin Atlantic',
        'Singapore Airlines', 'Cathay Pacific', 'Japan Airlines', 'ANA',
        'Korean Air', 'Air Canada', 'WestJet', 'Qantas'
      ];
      for (const airline of airlines) {
        if (text.includes(airline)) return airline;
      }
      return null;
    }
  }, origin, destination);

  log(`Extracted ${flights.length} flights from page`);

  // Sort by price
  flights.sort((a, b) => a.price - b.price);

  return flights;
}
