#!/usr/bin/env node

/**
 * TaskHawk - API Server
 *
 * Simple Express server that bridges the frontend to the
 * existing FlightDemo backend. Serves static files from public/.
 */

import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import { FlightDemo } from './src/demo/flight-demo.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'TaskHawk',
    hasApiKey: !!process.env.OPENAI_API_KEY,
    timestamp: new Date().toISOString()
  });
});

// Flight search endpoint
app.post('/api/search', async (req, res) => {
  const { goal, mode } = req.body;

  if (!goal || typeof goal !== 'string' || goal.trim().length === 0) {
    return res.status(400).json({ error: 'A search goal is required.' });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: 'Server missing OPENAI_API_KEY. Set it in .env.' });
  }

  const useMock = mode !== 'real';

  const demo = new FlightDemo({
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
    verbose: false,
    mockData: useMock
  });

  try {
    const results = await demo.run(goal);

    res.json({
      success: true,
      goal: results.goal,
      constraints: results.constraints,
      flights: results.flights,
      formatted: results.formatted,
      validation: results.validation,
      storage: results.storage,
      blobIds: results.blobIds,
      duration: results.duration,
      mode: useMock ? 'mock' : 'real'
    });
  } catch (err) {
    console.error('Search failed:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    await demo.cleanup();
  }
});

// SPA fallback — serve index.html for non-API routes
app.get('/{*path}', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🦅 TaskHawk server running at http://localhost:${PORT}`);
  console.log(`   API key: ${process.env.OPENAI_API_KEY ? 'Configured' : 'MISSING — set OPENAI_API_KEY in .env'}`);
  console.log(`   Mode: Press Ctrl+C to stop\n`);
});
