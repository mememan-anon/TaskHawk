/**
 * Walrus Client Module
 *
 * Client for storing and retrieving data from Walrus decentralized storage.
 * Uses the official Walrus HTTP API (publisher for writes, aggregator for reads).
 */

import dotenv from 'dotenv';
dotenv.config();

/**
 * WalrusClient class for interacting with Walrus storage.
 */
export class WalrusClient {
  /**
   * Create a new WalrusClient instance.
   * @param {Object} options - Configuration options
   * @param {string} [options.publisherUrl] - Walrus publisher URL (for storing)
   * @param {string} [options.aggregatorUrl] - Walrus aggregator URL (for reading)
   * @param {number} [options.epochs=1] - Number of epochs to store data
   * @param {number} [options.maxRetries=3] - Maximum retry attempts
   * @param {number} [options.retryDelay=1000] - Base retry delay in ms
   * @param {number} [options.timeout=30000] - Request timeout in ms
   * @param {boolean} [options.verbose=false] - Enable verbose logging
   */
  constructor(options = {}) {
    this.publisherUrl = options.publisherUrl ||
      process.env.WALRUS_PUBLISHER_URL ||
      'https://publisher.walrus-testnet.walrus.space';
    this.aggregatorUrl = options.aggregatorUrl ||
      process.env.WALRUS_AGGREGATOR_URL ||
      'https://aggregator.walrus-testnet.walrus.space';
    this.epochs = options.epochs || 1;
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 1000;
    this.timeout = options.timeout || 30000;
    this.verbose = options.verbose || false;
  }

  /**
   * Log debug information if verbose mode is enabled.
   * @private
   */
  debug(message, data = null) {
    if (this.verbose) {
      if (data !== null) {
        console.log(`[WalrusClient] ${message}`, data);
      } else {
        console.log(`[WalrusClient] ${message}`);
      }
    }
  }

  /**
   * Sleep for a specified duration.
   * @private
   */
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Execute an HTTP request with retry logic.
   * @private
   * @param {string} url - Full URL to request
   * @param {Object} options - Fetch options
   * @returns {Promise<Response>} Raw fetch response
   */
  async fetchWithRetry(url, options = {}) {
    let lastError = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        this.debug(`Fetch attempt ${attempt}/${this.maxRetries}: ${url}`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(url, {
          ...options,
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        return response;

      } catch (error) {
        lastError = error;
        this.debug(`Fetch attempt ${attempt} failed: ${error.message}`);

        if (error.name === 'AbortError') {
          throw new Error(`Request timeout after ${this.timeout}ms`);
        }

        if (attempt < this.maxRetries) {
          const delay = this.retryDelay * Math.pow(2, attempt - 1);
          this.debug(`Waiting ${delay}ms before retry...`);
          await this.sleep(delay);
        }
      }
    }

    throw new Error(`Request failed after ${this.maxRetries} attempts: ${lastError.message}`);
  }

  /**
   * Store data to Walrus storage via the publisher.
   * Uses PUT /v1/blobs with raw data body.
   * @async
   * @param {any} data - Data to store (will be JSON stringified)
   * @param {Object} [options] - Storage options
   * @returns {Promise<Object>} Storage result with blob ID
   */
  async store(data, options = {}) {
    if (data === undefined || data === null) {
      throw new Error('Cannot store undefined or null data');
    }

    this.debug('Storing data to Walrus...');

    const jsonBody = JSON.stringify(data);
    const epochs = options.epochs || this.epochs;

    try {
      const url = `${this.publisherUrl}/v1/blobs?epochs=${epochs}`;
      this.debug(`Uploading to: ${url}`);

      const response = await this.fetchWithRetry(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: jsonBody
      });

      const result = await response.json();

      // Handle the different response types from Walrus API
      let blobId = null;

      if (result.newlyCreated) {
        blobId = result.newlyCreated.blobObject?.blobId ||
                 result.newlyCreated.blobObject?.id ||
                 null;
        this.debug(`New blob created: ${blobId}`);
      } else if (result.alreadyCertified) {
        blobId = result.alreadyCertified.blobId ||
                 result.alreadyCertified.blobObject?.blobId ||
                 null;
        this.debug(`Blob already certified: ${blobId}`);
      } else if (result.markedInvalid) {
        throw new Error('Blob marked as invalid by Walrus');
      } else if (result.error) {
        throw new Error(`Walrus API error: ${result.error.message || JSON.stringify(result.error)}`);
      }

      if (!blobId) {
        this.debug('Full Walrus response:', JSON.stringify(result, null, 2));
        throw new Error('Could not extract blob ID from Walrus response');
      }

      return {
        success: true,
        blobId,
        result,
        size: jsonBody.length
      };

    } catch (error) {
      this.debug(`Storage failed: ${error.message}`);
      throw new Error(`Failed to store data to Walrus: ${error.message}`);
    }
  }

  /**
   * Retrieve data from Walrus storage by blob ID via the aggregator.
   * Uses GET /v1/blobs/{blob_id}.
   * @async
   * @param {string} blobId - The blob ID to retrieve
   * @returns {Promise<Object>} Retrieved data
   */
  async retrieve(blobId) {
    if (!blobId || typeof blobId !== 'string') {
      throw new Error('Invalid blob ID');
    }

    this.debug(`Retrieving data from Walrus: ${blobId}`);

    try {
      const url = `${this.aggregatorUrl}/v1/blobs/${blobId}`;

      const response = await this.fetchWithRetry(url, {
        method: 'GET'
      });

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }

      this.debug('Data retrieved successfully');

      return {
        success: true,
        blobId,
        data,
        size: text.length
      };

    } catch (error) {
      this.debug(`Retrieval failed: ${error.message}`);
      throw new Error(`Failed to retrieve data from Walrus: ${error.message}`);
    }
  }

  /**
   * Check if a blob exists in Walrus storage.
   * @async
   * @param {string} blobId - The blob ID to check
   * @returns {Promise<boolean>} True if blob exists
   */
  async exists(blobId) {
    try {
      await this.retrieve(blobId);
      return true;
    } catch (error) {
      this.debug(`Blob does not exist or is not accessible: ${blobId}`);
      return false;
    }
  }

  /**
   * Test connectivity to the Walrus API.
   * @async
   * @returns {Promise<Object>} Test result
   */
  async testConnectivity() {
    this.debug('Testing Walrus API connectivity...');

    try {
      const start = Date.now();

      // Store a small test object
      const testData = {
        test: true,
        timestamp: new Date().toISOString(),
        source: 'taskhawk-connectivity-test'
      };

      const storeResult = await this.store(testData);
      const blobId = storeResult.blobId;

      this.debug(`Test blob stored: ${blobId}`);

      // Retrieve it back
      const retrieveResult = await this.retrieve(blobId);
      const duration = Date.now() - start;

      // Verify data integrity
      const matches = JSON.stringify(retrieveResult.data) === JSON.stringify(testData);

      this.debug(`Connectivity test passed in ${duration}ms`);

      return {
        success: true,
        connected: true,
        duration,
        dataIntegrity: matches,
        blobId,
        message: 'Walrus API is accessible and working'
      };

    } catch (error) {
      this.debug(`Connectivity test failed: ${error.message}`);

      return {
        success: false,
        connected: false,
        error: error.message,
        message: `Walrus API connection failed: ${error.message}`
      };
    }
  }

  /**
   * Store a task definition with metadata.
   * @async
   * @param {string} taskId - Unique task identifier
   * @param {string} goal - Task goal/description
   * @param {Object} [metadata] - Additional metadata
   * @returns {Promise<Object>} Storage result with blob ID
   */
  async storeTask(taskId, goal, metadata = {}) {
    const taskData = {
      taskId,
      goal,
      type: 'task_definition',
      createdAt: new Date().toISOString(),
      ...metadata
    };

    return await this.store(taskData);
  }

  /**
   * Store an execution trace with metadata.
   * @async
   * @param {string} taskId - Associated task ID
   * @param {Object} trace - Execution trace object
   * @param {Object} [metadata] - Additional metadata
   * @returns {Promise<Object>} Storage result with blob ID
   */
  async storeTrace(taskId, trace, metadata = {}) {
    const traceData = {
      taskId,
      trace,
      type: 'execution_trace',
      createdAt: new Date().toISOString(),
      ...metadata
    };

    return await this.store(traceData);
  }
}

/**
 * Create a new WalrusClient instance with default options.
 * @param {Object} options - Configuration options
 * @returns {WalrusClient} New client instance
 */
export function createWalrusClient(options = {}) {
  return new WalrusClient(options);
}
