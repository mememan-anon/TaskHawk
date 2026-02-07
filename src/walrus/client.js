/**
 * Walrus Client Module
 *
 * Client for storing and retrieving data from Walrus decentralized storage.
 * Handles API communication with retry logic and error handling.
 */

/**
 * WalrusClient class for interacting with Walrus storage.
 */
export class WalrusClient {
  /**
   * Create a new WalrusClient instance.
   * @param {Object} options - Configuration options
   * @param {string} [options.apiUrl='https://walrus-testnet.aggregator.staging.aws.sui.io/v1/'] - Walrus API URL
   * @param {number} [options.maxRetries=3] - Maximum retry attempts
   * @param {number} [options.retryDelay=1000] - Base retry delay in ms
   * @param {number} [options.timeout=30000] - Request timeout in ms
   * @param {boolean} [options.verbose=false] - Enable verbose logging
   */
  constructor(options = {}) {
    this.apiUrl = options.apiUrl ||
      'https://walrus-testnet.aggregator.staging.aws.sui.io/v1/';
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 1000;
    this.timeout = options.timeout || 30000;
    this.verbose = options.verbose || false;
  }

  /**
   * Log debug information if verbose mode is enabled.
   * @private
   * @param {string} message - Message to log
   * @param {any} [data] - Optional data to log
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
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   */
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Execute an HTTP request with retry logic.
   * @private
   * @async
   * @param {string} url - Full URL to request
   * @param {Object} options - Fetch options
   * @param {string} [method] - HTTP method
   * @returns {Promise<Object>} Response data
   * @throws {Error} If request fails after all retries
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

        const data = await response.json();
        this.debug(`Fetch successful (attempt ${attempt})`);
        return data;

      } catch (error) {
        lastError = error;
        this.debug(`Fetch attempt ${attempt} failed: ${error.message}`);

        // Don't retry on certain errors
        if (error.name === 'AbortError') {
          throw new Error(`Request timeout after ${this.timeout}ms`);
        }

        // Exponential backoff
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
   * Store data to Walrus storage.
   * @async
   * @param {any} data - Data to store (will be JSON stringified)
   * @param {Object} [options] - Storage options
   * @param {string} [options.delegates] - Optional delegate address
   * @returns {Promise<Object>} Storage result with blob ID
   * @throws {Error} If storage fails
   * @example
   * const result = await client.store({ task: 'test', data: 'example' });
   * console.log(result.newlyCreated.blobObject.id); // Blob ID
   */
  async store(data, options = {}) {
    if (data === undefined || data === null) {
      throw new Error('Cannot store undefined or null data');
    }

    this.debug('Storing data to Walrus...');

    // Prepare the data
    const jsonBody = JSON.stringify(data);
    const blob = new Blob([jsonBody], { type: 'application/json' });

    try {
      // Create FormData for file upload
      const formData = new FormData();
      formData.append('file', blob, 'data.json');

      if (options.delegates) {
        formData.append('delegates', options.delegates);
      }

      // Upload to Walrus
      const url = `${this.apiUrl}staging`;
      this.debug(`Uploading to: ${url}`);

      const result = await this.fetchWithRetry(url, {
        method: 'POST',
        body: formData
      });

      if (!result || !result.newlyCreated || !result.newlyCreated.blobObject) {
        throw new Error('Invalid response from Walrus API');
      }

      const blobId = result.newlyCreated.blobObject.id;
      this.debug(`Data stored successfully. Blob ID: ${blobId}`);

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
   * Retrieve data from Walrus storage by blob ID.
   * @async
   * @param {string} blobId - The blob ID to retrieve
   * @param {Object} [options] - Retrieval options
   * @returns {Promise<Object>} Retrieved data
   * @throws {Error} If retrieval fails
   * @example
   * const data = await client.retrieve('blob_123456');
   * console.log(data.task); // 'test'
   */
  async retrieve(blobId, options = {}) {
    if (!blobId || typeof blobId !== 'string') {
      throw new Error('Invalid blob ID');
    }

    this.debug(`Retrieving data from Walrus: ${blobId}`);

    try {
      // First, get the blob info to find the storage nodes
      const infoUrl = `${this.apiUrl}staging/${blobId}`;
      const info = await this.fetchWithRetry(infoUrl, {
        method: 'GET'
      });

      if (!info || !info.storage || !info.storage.length) {
        throw new Error('Invalid blob info response');
      }

      // Try to retrieve from the first available storage node
      const storageNode = info.storage[0];
      const retrieveUrl = storageNode.endpoint;

      this.debug(`Retrieving from storage node: ${retrieveUrl}`);

      const response = await fetch(retrieveUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(this.timeout)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const jsonText = await response.text();
      const data = JSON.parse(jsonText);

      this.debug(`Data retrieved successfully`);

      return {
        success: true,
        blobId,
        data,
        size: jsonText.length
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
   * @returns {Promise<boolean>} True if blob exists, false otherwise
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

      // Try to store a small test object
      const testData = {
        test: true,
        timestamp: new Date().toISOString()
      };

      const storeResult = await this.store(testData);
      const blobId = storeResult.blobId;

      // Try to retrieve it back
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
