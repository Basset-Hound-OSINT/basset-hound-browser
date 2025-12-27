/**
 * Navigation commands for CLI
 */

const ora = require('ora');
const chalk = require('chalk');
const { createClient, output, handleError } = require('../utils/client');

function registerNavigateCommands(program) {
  // Navigate command
  program
    .command('navigate <url>')
    .alias('go')
    .description('Navigate to a URL')
    .option('-w, --wait <condition>', 'Wait condition (load, domcontentloaded, networkidle)', 'load')
    .action(async (url, options) => {
      const opts = program.opts();
      const spinner = opts.quiet ? null : ora(`Navigating to ${url}...`).start();

      try {
        const client = await createClient(opts);
        await client.sendCommand('navigate', { url, waitUntil: options.wait });

        const title = await client.getTitle();
        const currentUrl = await client.getUrl();

        if (spinner) spinner.succeed('Navigation complete');

        output(opts.format, {
          url: currentUrl,
          title
        });

        await client.disconnect();
      } catch (error) {
        if (spinner) spinner.fail('Navigation failed');
        handleError(error);
      }
    });

  // Back command
  program
    .command('back')
    .description('Navigate back in history')
    .action(async () => {
      const opts = program.opts();

      try {
        const client = await createClient(opts);
        await client.sendCommand('go_back');

        const url = await client.getUrl();
        console.log(chalk.green('Navigated back to:'), url);

        await client.disconnect();
      } catch (error) {
        handleError(error);
      }
    });

  // Forward command
  program
    .command('forward')
    .description('Navigate forward in history')
    .action(async () => {
      const opts = program.opts();

      try {
        const client = await createClient(opts);
        await client.sendCommand('go_forward');

        const url = await client.getUrl();
        console.log(chalk.green('Navigated forward to:'), url);

        await client.disconnect();
      } catch (error) {
        handleError(error);
      }
    });

  // Reload command
  program
    .command('reload')
    .description('Reload the current page')
    .option('--no-cache', 'Ignore cache when reloading')
    .action(async (options) => {
      const opts = program.opts();
      const spinner = opts.quiet ? null : ora('Reloading page...').start();

      try {
        const client = await createClient(opts);
        await client.sendCommand('reload', { ignoreCache: !options.cache });

        if (spinner) spinner.succeed('Page reloaded');
        await client.disconnect();
      } catch (error) {
        if (spinner) spinner.fail('Reload failed');
        handleError(error);
      }
    });

  // URL command
  program
    .command('url')
    .description('Get current URL')
    .action(async () => {
      const opts = program.opts();

      try {
        const client = await createClient(opts);
        const url = await client.getUrl();
        console.log(url);
        await client.disconnect();
      } catch (error) {
        handleError(error);
      }
    });

  // Title command
  program
    .command('title')
    .description('Get current page title')
    .action(async () => {
      const opts = program.opts();

      try {
        const client = await createClient(opts);
        const title = await client.getTitle();
        console.log(title);
        await client.disconnect();
      } catch (error) {
        handleError(error);
      }
    });

  // Click command
  program
    .command('click <selector>')
    .description('Click an element')
    .action(async (selector) => {
      const opts = program.opts();

      try {
        const client = await createClient(opts);
        await client.sendCommand('click', { selector });
        console.log(chalk.green('Clicked:'), selector);
        await client.disconnect();
      } catch (error) {
        handleError(error);
      }
    });

  // Type command
  program
    .command('type <selector> <text>')
    .description('Type text into an element')
    .option('-d, --delay <ms>', 'Delay between keystrokes', '50')
    .action(async (selector, text, options) => {
      const opts = program.opts();

      try {
        const client = await createClient(opts);
        await client.sendCommand('type', {
          selector,
          text,
          delay: parseInt(options.delay)
        });
        console.log(chalk.green('Typed into:'), selector);
        await client.disconnect();
      } catch (error) {
        handleError(error);
      }
    });

  // Scroll command
  program
    .command('scroll')
    .description('Scroll the page')
    .option('-x <pixels>', 'Horizontal scroll', '0')
    .option('-y <pixels>', 'Vertical scroll', '0')
    .option('-s, --selector <selector>', 'Element to scroll')
    .action(async (options) => {
      const opts = program.opts();

      try {
        const client = await createClient(opts);
        const params = {
          x: parseInt(options.x) || 0,
          y: parseInt(options.y) || 0
        };
        if (options.selector) params.selector = options.selector;

        await client.sendCommand('scroll', params);
        console.log(chalk.green('Scrolled'));
        await client.disconnect();
      } catch (error) {
        handleError(error);
      }
    });
}

module.exports = { registerNavigateCommands };
