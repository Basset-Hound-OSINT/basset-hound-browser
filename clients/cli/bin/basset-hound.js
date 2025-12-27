#!/usr/bin/env node

/**
 * Basset Hound Browser CLI
 * Command-line interface for browser automation
 */

const { program } = require('commander');
const pkg = require('../package.json');

// Import commands
const { registerNavigateCommands } = require('../src/commands/navigate');
const { registerExtractCommands } = require('../src/commands/extract');
const { registerNetworkCommands } = require('../src/commands/network');
const { registerScreenshotCommands } = require('../src/commands/screenshot');

// Global options
program
  .name('basset-hound')
  .description('CLI for Basset Hound Browser automation')
  .version(pkg.version)
  .option('-H, --host <host>', 'WebSocket host', 'localhost')
  .option('-p, --port <port>', 'WebSocket port', '8765')
  .option('-f, --format <format>', 'Output format (json, table, plain)', 'plain')
  .option('-t, --timeout <ms>', 'Command timeout in ms', '30000')
  .option('-q, --quiet', 'Suppress non-essential output');

// Register command groups
registerNavigateCommands(program);
registerExtractCommands(program);
registerNetworkCommands(program);
registerScreenshotCommands(program);

// Connect command
program
  .command('connect')
  .description('Test connection to the browser')
  .action(async () => {
    const { createClient, output, handleError } = require('../src/utils/client');
    const ora = require('ora');
    const opts = program.opts();

    const spinner = ora('Connecting to browser...').start();

    try {
      const client = await createClient(opts);
      spinner.succeed('Connected to Basset Hound Browser');

      // Get some info
      const url = await client.getUrl();
      const title = await client.getTitle();

      output(opts.format, {
        connected: true,
        host: opts.host,
        port: opts.port,
        currentUrl: url,
        currentTitle: title
      });

      await client.disconnect();
    } catch (error) {
      spinner.fail('Connection failed');
      handleError(error);
    }
  });

// Status command
program
  .command('status')
  .description('Get browser status')
  .action(async () => {
    const { createClient, output, handleError } = require('../src/utils/client');
    const opts = program.opts();

    try {
      const client = await createClient(opts);

      const url = await client.getUrl();
      const title = await client.getTitle();
      const tabs = await client.sendCommand('get_tabs');

      output(opts.format, {
        url,
        title,
        tabs: tabs.tabs?.length || 0
      });

      await client.disconnect();
    } catch (error) {
      handleError(error);
    }
  });

// Execute JavaScript command
program
  .command('exec <script>')
  .description('Execute JavaScript in page context')
  .action(async (script) => {
    const { createClient, output, handleError } = require('../src/utils/client');
    const opts = program.opts();

    try {
      const client = await createClient(opts);
      const result = await client.sendCommand('execute_script', { script });

      output(opts.format, result);
      await client.disconnect();
    } catch (error) {
      handleError(error);
    }
  });

// Cookies commands
program
  .command('cookies')
  .description('Get all cookies')
  .option('-u, --url <url>', 'Filter by URL')
  .action(async (options) => {
    const { createClient, output, handleError } = require('../src/utils/client');
    const opts = program.opts();

    try {
      const client = await createClient(opts);
      const params = {};
      if (options.url) params.url = options.url;

      const result = await client.sendCommand('get_cookies', params);
      output(opts.format, result);
      await client.disconnect();
    } catch (error) {
      handleError(error);
    }
  });

// User agent command
program
  .command('user-agent <ua>')
  .description('Set browser user agent')
  .action(async (ua) => {
    const { createClient, output, handleError } = require('../src/utils/client');
    const opts = program.opts();

    try {
      const client = await createClient(opts);
      const result = await client.sendCommand('set_user_agent', { userAgent: ua });
      output(opts.format, { success: true, userAgent: ua });
      await client.disconnect();
    } catch (error) {
      handleError(error);
    }
  });

// Viewport command
program
  .command('viewport <width> <height>')
  .description('Set browser viewport size')
  .action(async (width, height) => {
    const { createClient, output, handleError } = require('../src/utils/client');
    const opts = program.opts();

    try {
      const client = await createClient(opts);
      await client.sendCommand('set_viewport', {
        width: parseInt(width),
        height: parseInt(height)
      });
      output(opts.format, { success: true, width: parseInt(width), height: parseInt(height) });
      await client.disconnect();
    } catch (error) {
      handleError(error);
    }
  });

// Fingerprint commands
program
  .command('fingerprint')
  .description('Get current browser fingerprint')
  .action(async () => {
    const { createClient, output, handleError } = require('../src/utils/client');
    const opts = program.opts();

    try {
      const client = await createClient(opts);
      const result = await client.sendCommand('get_fingerprint');
      output(opts.format, result);
      await client.disconnect();
    } catch (error) {
      handleError(error);
    }
  });

program
  .command('randomize')
  .description('Randomize browser fingerprint')
  .action(async () => {
    const { createClient, output, handleError } = require('../src/utils/client');
    const chalk = require('chalk');
    const opts = program.opts();

    try {
      const client = await createClient(opts);
      await client.sendCommand('randomize_fingerprint');
      console.log(chalk.green('Fingerprint randomized successfully'));
      await client.disconnect();
    } catch (error) {
      handleError(error);
    }
  });

// Parse and execute
program.parse();
