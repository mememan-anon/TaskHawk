# Mad Sniper - Autonomous Web Task Orchestrator

An intelligent system that plans and executes web-based tasks using LLM-powered decomposition and execution.

## Overview

Mad Sniper takes natural language goals and breaks them down into executable steps, then orchestrates their execution with full trace logging.

## Installation

```bash
npm install
cp .env.example .env
# Edit .env and add your OpenAI API key
```

## Usage

```bash
# Basic usage
node src/index.js --goal "Find flights from SFO to JFK next week under $500"

# Test with sample flight goal
npm test
```

## Architecture

- **Planner**: Uses LLM to decompose goals into structured JSON plans
- **Executor**: (Coming in Day 2) Executes the planned steps
- **Logger**: Tracks execution traces and state changes
- **Walrus**: (Coming in Day 2) Handles web interactions

## Project Structure

```
mad-sniper/
├── src/
│   ├── planner/     # LLM-based task decomposition
│   ├── executor/    # Step execution engine
│   ├── logger/      # Execution trace tracking
│   ├── walrus/      # Web interaction module
│   └── utils/       # Shared utilities
└── package.json
```

## Day 1 Status

- ✅ Project setup
- ✅ Planner with LLM integration
- ✅ Logger with state tracking
- ✅ Basic goal → plan → log flow

## License

MIT
