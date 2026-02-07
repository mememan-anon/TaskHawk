/**
 * Task Planner Module
 *
 * Uses LLM to decompose natural language goals into structured execution plans.
 */

import OpenAI from 'openai';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * TaskPlanner class for LLM-based task decomposition.
 * Generates structured JSON execution plans from natural language goals.
 */
export class TaskPlanner {
  /**
   * Create a new TaskPlanner instance.
   * @param {Object} options - Planner configuration options
   * @param {string} [options.apiKey] - OpenAI API key (defaults to OPENAI_API_KEY env var)
   * @param {string} [options.model] - Model to use (defaults to zai/glm-4.7)
   * @param {string} [options.baseUrl] - Custom base URL for API
   */
  constructor(options = {}) {
    this.apiKey = options.apiKey || process.env.OPENAI_API_KEY;
    this.model = options.model || process.env.OPENAI_MODEL || 'gpt-3.5-turbo';

    if (!this.apiKey) {
      throw new Error('OpenAI API key is required. Set OPENAI_API_KEY environment variable.');
    }

    this.client = new OpenAI({
      apiKey: this.apiKey,
      baseURL: options.baseUrl || 'https://api.openai.com/v1',
      dangerouslyAllowBrowser: false
    });
  }

  /**
   * Create an execution plan from a natural language goal.
   *
   * @param {string} goal - The natural language goal to plan
   * @param {Object} context - Optional context about the goal
   * @returns {Promise<Object>} Structured execution plan
   *
   * @example
   * const plan = await planner.createPlan("Find flights from SFO to JFK next week under $500");
   * // Returns: { steps: [...], constraints: {...}, estimatedDuration: ... }
   */
  async createPlan(goal, context = {}) {
    const systemPrompt = `You are an expert task planner that breaks down complex web-based goals into executable steps.

Your role:
1. Analyze the user's goal and identify what they want to accomplish
2. Decompose the goal into clear, actionable steps
3. Extract any constraints or preferences mentioned
4. Return a structured JSON plan

Rules:
- Each step should be atomic and executable
- Steps should follow logical dependencies
- Include all constraints mentioned (dates, prices, preferences)
- Return valid JSON only, no explanations
- Be specific about what each step should do

Step types:
- "search": Search for information
- "filter": Apply criteria to results
- "compare": Compare options
- "select": Make a selection
- "navigate": Navigate to a page/section
- "input": Enter data into a form
- "click": Click an element
- "wait": Wait for something to load
- "extract": Extract data from the page
- "validate": Verify a condition
- "finish": Task completion`;

    const userPrompt = `Create an execution plan for this goal:

GOAL: "${goal}"

${context.constraints ? `DETECTED CONSTRAINTS: ${JSON.stringify(context.constraints)}` : ''}

Return a JSON object with this structure:
{
  "goalSummary": "Brief summary of what to accomplish",
  "goalType": "flight|hotel|restaurant|general|other",
  "constraints": {
    "origin": "...",
    "destination": "...",
    "maxPrice": ...,
    "timeframe": "...",
    "anyOtherFields": "..."
  },
  "estimatedSteps": <number>,
  "steps": [
    {
      "id": "step_1",
      "name": "Human-readable step name",
      "type": "search|navigate|input|click|filter|compare|select|extract|validate|finish",
      "description": "What this step does",
      "input": { ...any input data needed... },
      "expectedOutput": "What we expect to get from this step",
      "dependencies": ["step_0"]  // Array of step IDs this depends on (empty for first step)
    }
  ]
}`;

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 2000,
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response content from LLM');
      }

      const plan = JSON.parse(content);

      // Validate plan structure
      if (!plan.steps || !Array.isArray(plan.steps)) {
        throw new Error('Invalid plan: missing or invalid steps array');
      }

      // Assign step indices if not present
      plan.steps = plan.steps.map((step, idx) => ({
        ...step,
        id: step.id || `step_${idx}`,
        index: idx
      }));

      // Add plan metadata
      plan.createdAt = new Date().toISOString();
      plan.totalSteps = plan.steps.length;

      return plan;

    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Failed to parse LLM response as JSON: ${error.message}`);
      }
      throw new Error(`Plan generation failed: ${error.message}`);
    }
  }

  /**
   * Extract constraints from a goal using the LLM.
   * This is a focused extraction for specific domains like flight search.
   *
   * @param {string} goal - The natural language goal
   * @param {string} domain - Domain to extract constraints for (flight, hotel, etc.)
   * @returns {Promise<Object>} Extracted constraints
   */
  async extractConstraints(goal, domain = 'general') {
    const domainSpecifics = {
      flight: `Extract flight search constraints:
- Origin airport/city
- Destination airport/city
- Departure date or timeframe
- Return date (if round trip)
- Max price/budget
- Number of passengers
- Airline preference
- Cabin class preference`,
      hotel: `Extract hotel search constraints:
- Location (city, area, near landmark)
- Check-in date
- Check-out date
- Max price per night
- Star rating preference
- Amenities required
- Number of rooms/guests`,
      general: `Extract any constraints or preferences mentioned in the goal.`
    };

    const prompt = `Extract constraints from this goal in the ${domain} domain:

GOAL: "${goal}"

${domainSpecifics[domain] || domainSpecifics.general}

Return JSON:
{
  "constraints": {
    "field1": "value1",
    "field2": "value2"
  },
  "hasAllRequiredInfo": true/false,
  "missingFields": ["field1", "field2"]
}`;

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: 'You are a constraint extraction assistant. Return valid JSON only.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2,
        max_tokens: 500,
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0]?.message?.content;
      return JSON.parse(content);

    } catch (error) {
      throw new Error(`Constraint extraction failed: ${error.message}`);
    }
  }

  /**
   * Refine a plan based on feedback or new information.
   *
   * @param {Object} existingPlan - The existing plan to refine
   * @param {string} feedback - Feedback or new requirements
   * @returns {Promise<Object>} Refined execution plan
   */
  async refinePlan(existingPlan, feedback) {
    const prompt = `Refine this execution plan based on feedback:

CURRENT PLAN:
${JSON.stringify(existingPlan, null, 2)}

FEEDBACK:
${feedback}

Update the plan as needed and return the full refined plan in JSON format. Maintain the same structure.`;

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: 'You are a task planner that refines execution plans. Return valid JSON only.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 2000,
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0]?.message?.content;
      const refinedPlan = JSON.parse(content);

      refinedPlan.refinedAt = new Date().toISOString();
      refinedPlan.refinementCount = (existingPlan.refinementCount || 0) + 1;

      return refinedPlan;

    } catch (error) {
      throw new Error(`Plan refinement failed: ${error.message}`);
    }
  }

  /**
   * Validate that a plan is well-formed and executable.
   *
   * @param {Object} plan - The plan to validate
   * @returns {Object} Validation result with isValid flag and errors
   */
  validatePlan(plan) {
    const errors = [];
    const warnings = [];

    if (!plan.goalSummary) {
      errors.push('Missing goalSummary');
    }

    if (!plan.steps || !Array.isArray(plan.steps)) {
      errors.push('Missing or invalid steps array');
    } else {
      if (plan.steps.length === 0) {
        errors.push('Plan has no steps');
      }

      // Check for duplicate step IDs
      const stepIds = plan.steps.map(s => s.id);
      const duplicates = stepIds.filter((id, idx) => stepIds.indexOf(id) !== idx);
      if (duplicates.length > 0) {
        errors.push(`Duplicate step IDs: ${duplicates.join(', ')}`);
      }

      // Validate dependencies exist
      plan.steps.forEach((step, idx) => {
        if (step.dependencies) {
          step.dependencies.forEach(dep => {
            if (!stepIds.includes(dep)) {
              errors.push(`Step ${step.id} depends on non-existent step ${dep}`);
            }
          });
        }
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}

/**
 * Create a new planner instance with optional configuration.
 * @param {Object} options - Planner options
 * @returns {TaskPlanner} New planner instance
 */
export function createPlanner(options = {}) {
  return new TaskPlanner(options);
}
