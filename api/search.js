/**
 * Vercel Serverless Function — POST /api/search
 *
 * Wraps FlightDemo for serverless execution.
 * Supports 'api' mode (SerpApi — real prices) and 'mock' mode.
 * Puppeteer browser mode is not available on serverless.
 */

import { FlightDemo } from '../src/demo/flight-demo.js';
import dotenv from 'dotenv';

dotenv.config();

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { goal, mode } = req.body || {};

  if (!goal || typeof goal !== 'string' || goal.trim().length === 0) {
    return res.status(400).json({ error: 'A search goal is required.' });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: 'Server missing OPENAI_API_KEY. Set it in Vercel environment variables.' });
  }

  // On Vercel: 'api' (real prices via SerpApi) or 'mock'. Browser mode not available.
  let execMode = mode === 'api' ? 'api' : 'mock';
  if (mode === 'real') {
    // Fall back to API mode if SerpApi key is set, otherwise mock
    execMode = process.env.SERPAPI_KEY ? 'api' : 'mock';
    console.warn('Browser mode unavailable on serverless. Using:', execMode);
  }

  const demo = new FlightDemo({
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
    verbose: false,
    mode: execMode,
    headless: true
  });

  try {
    const results = await demo.run(goal);

    return res.status(200).json({
      success: true,
      goal: results.goal,
      constraints: results.constraints,
      flights: results.flights,
      formatted: results.formatted,
      validation: results.validation,
      storage: results.storage,
      blobIds: results.blobIds,
      duration: results.duration,
      mode: execMode
    });
  } catch (err) {
    console.error('Search failed:', err.message);
    return res.status(500).json({ error: err.message });
  } finally {
    await demo.cleanup();
  }
}
