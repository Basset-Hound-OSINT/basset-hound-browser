/**
 * WebSocket client wrapper for CLI
 */

const WebSocket = require('ws');
const chalk = require('chalk');

/**
 * Generate unique request ID
 */
function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Simple WebSocket client for CLI commands
 */
class CLIClient {
  constructor(host, port, timeout) {
    this.host = host;
    this.port = port;
    this.timeout = timeout;
    this.ws = null;
    this.pendingRequests = new Map();
  }

  get url() {
    return `ws://${this.host}:${this.port}`;
  }

  /**
   * Connect to browser
   */
  connect() {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Connection timeout after ${this.timeout}ms`));
      }, this.timeout);

      this.ws = new WebSocket(this.url);

      this.ws.on('open', () => {
        clearTimeout(timeoutId);
        resolve();
      });

      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          const requestId = message.id;

          if (requestId && this.pendingRequests.has(requestId)) {
            const { resolve, reject, timeoutId } = this.pendingRequests.get(requestId);
            this.pendingRequests.delete(requestId);
            clearTimeout(timeoutId);

            if (message.success === false) {
              reject(new Error(message.error || 'Command failed'));
            } else {
              resolve(message);
            }
          }
        } catch (e) {
          // Ignore parse errors
        }
      });

      this.ws.on('error', (error) => {
        clearTimeout(timeoutId);
        reject(new Error(`Connection error: ${error.message}`));
      });
    });
  }

  /**
   * Disconnect from browser
   */
  disconnect() {
    return new Promise((resolve) => {
      if (this.ws) {
        this.ws.once('close', resolve);
        this.ws.close();
      } else {
        resolve();
      }
    });
  }

  /**
   * Send command and wait for response
   */
  sendCommand(command, params = {}) {
    return new Promise((resolve, reject) => {
      const requestId = generateId();

      const message = {
        id: requestId,
        command,
        ...params
      };

      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Command '${command}' timed out`));
      }, this.timeout);

      this.pendingRequests.set(requestId, { resolve, reject, timeoutId });
      this.ws.send(JSON.stringify(message));
    });
  }

  // Convenience methods
  async getUrl() {
    const result = await this.sendCommand('get_url');
    return result.url || '';
  }

  async getTitle() {
    const result = await this.sendCommand('get_title');
    return result.title || '';
  }
}

/**
 * Create and connect client
 */
async function createClient(opts) {
  const client = new CLIClient(
    opts.host || 'localhost',
    parseInt(opts.port) || 8765,
    parseInt(opts.timeout) || 30000
  );
  await client.connect();
  return client;
}

/**
 * Output data in specified format
 */
function output(format, data) {
  switch (format) {
    case 'json':
      console.log(JSON.stringify(data, null, 2));
      break;

    case 'table':
      const Table = require('cli-table3');
      if (Array.isArray(data)) {
        if (data.length > 0) {
          const keys = Object.keys(data[0]);
          const table = new Table({ head: keys });
          data.forEach(item => {
            table.push(keys.map(k => String(item[k] || '')));
          });
          console.log(table.toString());
        }
      } else if (typeof data === 'object') {
        const table = new Table();
        Object.entries(data).forEach(([key, value]) => {
          const displayValue = typeof value === 'object'
            ? JSON.stringify(value)
            : String(value);
          table.push({ [key]: displayValue });
        });
        console.log(table.toString());
      } else {
        console.log(data);
      }
      break;

    case 'plain':
    default:
      if (typeof data === 'object') {
        Object.entries(data).forEach(([key, value]) => {
          if (typeof value === 'object') {
            console.log(`${chalk.cyan(key)}:`);
            console.log(JSON.stringify(value, null, 2));
          } else {
            console.log(`${chalk.cyan(key)}: ${value}`);
          }
        });
      } else {
        console.log(data);
      }
      break;
  }
}

/**
 * Handle and display error
 */
function handleError(error) {
  console.error(chalk.red('Error:'), error.message);
  process.exit(1);
}

module.exports = {
  CLIClient,
  createClient,
  output,
  handleError
};
