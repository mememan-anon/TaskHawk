/**
 * TaskHawk — Frontend Client
 */

const form = document.getElementById('search-form');
const goalInput = document.getElementById('goal-input');
const searchBtn = document.getElementById('search-btn');
const modeToggle = document.getElementById('mode-toggle');

const loadingEl = document.getElementById('loading');
const errorEl = document.getElementById('error');
const errorMsg = document.getElementById('error-msg');
const resultsEl = document.getElementById('results');

const resultsTitle = document.getElementById('results-title');
const resultsCount = document.getElementById('results-count');
const resultsDuration = document.getElementById('results-duration');
const resultsMode = document.getElementById('results-mode');
const constraintsBar = document.getElementById('constraints-bar');
const flightCards = document.getElementById('flight-cards');
const provenanceEl = document.getElementById('provenance');
const provenanceLinks = document.getElementById('provenance-links');
const traceSteps = document.getElementById('trace-steps');

// Phase animation
let phaseInterval = null;

function startPhaseAnimation() {
  const phases = loadingEl.querySelectorAll('.phase');
  let current = 0;
  phases.forEach(p => p.classList.remove('active', 'done'));
  phases[0].classList.add('active');

  phaseInterval = setInterval(() => {
    if (current < phases.length) {
      phases[current].classList.remove('active');
      phases[current].classList.add('done');
    }
    current++;
    if (current < phases.length) {
      phases[current].classList.add('active');
    } else {
      clearInterval(phaseInterval);
    }
  }, 1800);
}

function stopPhaseAnimation() {
  if (phaseInterval) clearInterval(phaseInterval);
  const phases = loadingEl.querySelectorAll('.phase');
  phases.forEach(p => {
    p.classList.remove('active');
    p.classList.add('done');
  });
}

// Show / hide helpers
function showLoading() {
  loadingEl.classList.remove('hidden');
  errorEl.classList.add('hidden');
  resultsEl.classList.add('hidden');
  searchBtn.disabled = true;
  searchBtn.textContent = 'Searching...';
  startPhaseAnimation();
}

function showError(msg) {
  stopPhaseAnimation();
  loadingEl.classList.add('hidden');
  resultsEl.classList.add('hidden');
  errorEl.classList.remove('hidden');
  errorMsg.textContent = msg;
  searchBtn.disabled = false;
  searchBtn.textContent = 'Search';
}

function showResults(data) {
  stopPhaseAnimation();
  loadingEl.classList.add('hidden');
  errorEl.classList.add('hidden');
  resultsEl.classList.remove('hidden');
  searchBtn.disabled = false;
  searchBtn.textContent = 'Search';
  renderResults(data);
}

// Render results
function renderResults(data) {
  // Title & meta
  resultsTitle.textContent = `Flights: ${data.constraints.origin || '?'} \u2192 ${data.constraints.destination || '?'}`;
  resultsCount.textContent = `${data.flights.length} flights`;
  resultsDuration.textContent = `${(data.duration / 1000).toFixed(1)}s`;
  resultsMode.textContent = data.mode === 'real' ? 'Live' : 'Mock';

  // Constraints
  constraintsBar.innerHTML = '';
  if (data.constraints.origin) addTag(`From: ${data.constraints.origin}`);
  if (data.constraints.destination) addTag(`To: ${data.constraints.destination}`);
  if (data.constraints.maxPrice) addTag(`Max: $${data.constraints.maxPrice}`);
  if (data.constraints.timeframe) addTag(data.constraints.timeframe);

  // Flight cards
  flightCards.innerHTML = '';
  data.flights.forEach((flight, i) => {
    flightCards.appendChild(createFlightCard(flight, i));
  });

  // Provenance
  if (data.blobIds && (data.blobIds.task || data.blobIds.trace)) {
    provenanceEl.classList.remove('hidden');
    provenanceLinks.innerHTML = '';
    const aggregator = 'https://aggregator.walrus-testnet.walrus.space';

    if (data.blobIds.task) {
      addProvenanceLink('Task', `${aggregator}/v1/blobs/${data.blobIds.task}`, data.blobIds.task);
    }
    if (data.blobIds.trace) {
      addProvenanceLink('Trace', `${aggregator}/v1/blobs/${data.blobIds.trace}`, data.blobIds.trace);
    }
  } else {
    provenanceEl.classList.add('hidden');
  }

  // Trace
  traceSteps.innerHTML = '';
  if (data.storage && data.storage.success !== undefined) {
    addTraceStep('Goal parsed', 'success');
    addTraceStep('Plan created (LLM)', 'success');
    addTraceStep('Flights searched', 'success');
    addTraceStep(
      data.validation.isValid ? 'Results validated' : `Validation: ${data.validation.issues.join(', ')}`,
      data.validation.isValid ? 'success' : 'warning'
    );
    addTraceStep(
      data.storage.success ? 'Stored to Walrus' : `Walrus: ${data.storage.error || 'skipped'}`,
      data.storage.success ? 'success' : 'warning'
    );
  }
}

function addTag(text) {
  const el = document.createElement('span');
  el.className = 'constraint-tag';
  el.textContent = text;
  constraintsBar.appendChild(el);
}

function createFlightCard(flight, index) {
  const card = document.createElement('div');
  card.className = 'flight-card';

  card.innerHTML = `
    <div class="rank">#${index + 1}</div>
    <div class="flight-info">
      <span class="flight-airline">${esc(flight.airline)}</span>
      <span class="flight-number">${esc(flight.flightNumber)}</span>
      <span class="flight-route">${esc(flight.origin)} &rarr; ${esc(flight.destination)}</span>
      <span class="flight-times">${esc(flight.departureTime)} &mdash; ${esc(flight.arrivalTime)}</span>
      <span class="flight-details">${esc(flight.duration)} &bull; ${esc(flight.stops)} &bull; ${esc(flight.aircraft)}</span>
    </div>
    <div class="flight-price">$${flight.price}</div>
  `;

  return card;
}

function addProvenanceLink(label, url, blobId) {
  const el = document.createElement('div');
  el.className = 'provenance-link';
  el.innerHTML = `<span class="provenance-label">${label}:</span> <a href="${esc(url)}" target="_blank" rel="noopener">${esc(blobId)}</a>`;
  provenanceLinks.appendChild(el);
}

function addTraceStep(text, status) {
  const el = document.createElement('div');
  el.className = 'trace-step';
  el.innerHTML = `<span class="dot ${status}"></span> ${esc(text)}`;
  traceSteps.appendChild(el);
}

// Escape HTML
function esc(str) {
  if (str == null) return '';
  const d = document.createElement('div');
  d.textContent = String(str);
  return d.innerHTML;
}

// Form submit
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const goal = goalInput.value.trim();
  if (!goal) return;

  showLoading();

  try {
    const res = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        goal,
        mode: modeToggle.checked ? 'real' : 'mock'
      })
    });

    const data = await res.json();

    if (!res.ok) {
      showError(data.error || 'Something went wrong.');
      return;
    }

    showResults(data);
  } catch (err) {
    showError('Network error — is the server running?');
  }
});

// Chip click
document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    goalInput.value = chip.dataset.goal;
    form.dispatchEvent(new Event('submit'));
  });
});
