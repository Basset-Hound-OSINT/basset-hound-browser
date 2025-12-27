/**
 * Screenshot commands for CLI
 */

const ora = require('ora');
const chalk = require('chalk');
const path = require('path');
const { createClient, output, handleError } = require('../utils/client');

function registerScreenshotCommands(program) {
  // Screenshot command
  program
    .command('screenshot [filename]')
    .alias('ss')
    .description('Take a screenshot')
    .option('--full', 'Capture full page')
    .option('--jpeg', 'Save as JPEG instead of PNG')
    .option('-q, --quality <quality>', 'JPEG quality (1-100)', '80')
    .action(async (filename, options) => {
      const opts = program.opts();

      // Generate filename if not provided
      const format = options.jpeg ? 'jpeg' : 'png';
      const ext = options.jpeg ? '.jpg' : '.png';
      const outputFile = filename || `screenshot-${Date.now()}${ext}`;

      const spinner = opts.quiet ? null : ora('Taking screenshot...').start();

      try {
        const client = await createClient(opts);

        // Use absolute path
        const absolutePath = path.isAbsolute(outputFile)
          ? outputFile
          : path.join(process.cwd(), outputFile);

        await client.sendCommand('save_screenshot', {
          path: absolutePath,
          fullPage: options.full || false,
          format,
          quality: parseInt(options.quality)
        });

        if (spinner) spinner.succeed(`Screenshot saved to: ${outputFile}`);
        await client.disconnect();
      } catch (error) {
        if (spinner) spinner.fail('Screenshot failed');
        handleError(error);
      }
    });

  // Screenshot to base64
  program
    .command('screenshot-base64')
    .description('Take a screenshot and output as base64')
    .option('--full', 'Capture full page')
    .option('--jpeg', 'Output as JPEG')
    .action(async (options) => {
      const opts = program.opts();

      try {
        const client = await createClient(opts);
        const result = await client.sendCommand('screenshot', {
          fullPage: options.full || false,
          format: options.jpeg ? 'jpeg' : 'png'
        });

        // Just output the base64 data
        if (result.data) {
          console.log(result.data);
        } else {
          output(opts.format, result);
        }

        await client.disconnect();
      } catch (error) {
        handleError(error);
      }
    });
}

module.exports = { registerScreenshotCommands };
