/**
 * Network analysis commands for CLI
 */

const ora = require('ora');
const chalk = require('chalk');
const { createClient, output, handleError } = require('../utils/client');

function registerNetworkCommands(program) {
  // Network command group
  const network = program
    .command('network <action>')
    .description('Network capture commands (start, stop, requests, stats, export, clear)')
    .option('-t, --type <type>', 'Filter by request type')
    .option('-d, --domain <domain>', 'Filter by domain')
    .option('--format-export <format>', 'Export format (har, json)', 'har')
    .action(async (action, options) => {
      const opts = program.opts();

      try {
        const client = await createClient(opts);
        let result;

        switch (action) {
          case 'start':
            const spinner1 = opts.quiet ? null : ora('Starting network capture...').start();
            result = await client.sendCommand('start_network_capture');
            if (spinner1) spinner1.succeed('Network capture started');
            break;

          case 'stop':
            const spinner2 = opts.quiet ? null : ora('Stopping network capture...').start();
            result = await client.sendCommand('stop_network_capture');
            if (spinner2) spinner2.succeed('Network capture stopped');
            break;

          case 'requests':
          case 'reqs':
            const params = {};
            if (options.type) params.filterType = options.type;
            if (options.domain) params.filterDomain = options.domain;
            result = await client.sendCommand('get_network_requests', params);

            if (opts.format === 'plain' && result.requests) {
              console.log(chalk.cyan(`\nNetwork Requests (${result.requests.length}):`));
              result.requests.forEach((req, i) => {
                const statusColor = req.status >= 400 ? 'red' :
                  req.status >= 300 ? 'yellow' : 'green';
                console.log(`  ${i + 1}. ${chalk[statusColor](req.status || '---')} ${req.method} ${req.url}`);
                console.log(`     ${chalk.gray(`Type: ${req.type || 'unknown'}, Size: ${req.size || 0} bytes`)}`);
              });
            } else {
              output(opts.format, result);
            }
            break;

          case 'stats':
          case 'statistics':
            result = await client.sendCommand('get_network_statistics');

            if (opts.format === 'plain') {
              console.log(chalk.cyan('\nNetwork Statistics:'));
              console.log(`  Total Requests: ${result.totalRequests || 0}`);
              console.log(`  Total Size: ${formatBytes(result.totalSize || 0)}`);
              console.log(`  By Type:`);
              if (result.byType) {
                Object.entries(result.byType).forEach(([type, count]) => {
                  console.log(`    ${chalk.gray(type)}: ${count}`);
                });
              }
            } else {
              output(opts.format, result);
            }
            break;

          case 'export':
            result = await client.sendCommand('export_network_capture', {
              format: options.formatExport
            });
            output(opts.format, result);
            break;

          case 'clear':
            result = await client.sendCommand('clear_network_capture');
            console.log(chalk.green('Network capture cleared'));
            break;

          case 'status':
            result = await client.sendCommand('get_network_capture_status');
            output(opts.format, result);
            break;

          default:
            console.error(chalk.red(`Unknown action: ${action}`));
            console.log('Available actions: start, stop, requests, stats, export, clear, status');
            process.exit(1);
        }

        await client.disconnect();
      } catch (error) {
        handleError(error);
      }
    });

  // Shortcut commands
  program
    .command('requests')
    .description('Get captured network requests (shortcut)')
    .option('-t, --type <type>', 'Filter by request type')
    .option('-d, --domain <domain>', 'Filter by domain')
    .action(async (options) => {
      const opts = program.opts();

      try {
        const client = await createClient(opts);
        const params = {};
        if (options.type) params.filterType = options.type;
        if (options.domain) params.filterDomain = options.domain;

        const result = await client.sendCommand('get_network_requests', params);
        output(opts.format, result);
        await client.disconnect();
      } catch (error) {
        handleError(error);
      }
    });

  program
    .command('slow-requests')
    .description('Get slow network requests')
    .option('--threshold <ms>', 'Threshold in ms', '1000')
    .action(async (options) => {
      const opts = program.opts();

      try {
        const client = await createClient(opts);
        const result = await client.sendCommand('get_slow_requests', {
          threshold: parseInt(options.threshold)
        });

        if (opts.format === 'plain' && result.requests) {
          console.log(chalk.cyan(`\nSlow Requests (>${options.threshold}ms):`));
          result.requests.forEach((req, i) => {
            console.log(`  ${i + 1}. ${chalk.yellow(req.duration + 'ms')} ${req.method} ${req.url}`);
          });
        } else {
          output(opts.format, result);
        }

        await client.disconnect();
      } catch (error) {
        handleError(error);
      }
    });

  program
    .command('failed-requests')
    .description('Get failed network requests')
    .action(async () => {
      const opts = program.opts();

      try {
        const client = await createClient(opts);
        const result = await client.sendCommand('get_failed_requests');

        if (opts.format === 'plain' && result.requests) {
          console.log(chalk.cyan(`\nFailed Requests (${result.requests.length}):`));
          result.requests.forEach((req, i) => {
            console.log(`  ${i + 1}. ${chalk.red(req.status)} ${req.method} ${req.url}`);
            if (req.error) console.log(`     ${chalk.gray(req.error)}`);
          });
        } else {
          output(opts.format, result);
        }

        await client.disconnect();
      } catch (error) {
        handleError(error);
      }
    });

  program
    .command('security-headers')
    .description('Analyze security headers')
    .action(async () => {
      const opts = program.opts();

      try {
        const client = await createClient(opts);
        const result = await client.sendCommand('analyze_security_headers');

        if (opts.format === 'plain') {
          console.log(chalk.cyan('\nSecurity Headers Analysis:'));
          if (result.headers) {
            result.headers.forEach(header => {
              const icon = header.present ? chalk.green('✓') : chalk.red('✗');
              console.log(`  ${icon} ${header.name}: ${header.present ? header.value : 'Missing'}`);
            });
          }
          if (result.score !== undefined) {
            const scoreColor = result.score >= 80 ? 'green' :
              result.score >= 50 ? 'yellow' : 'red';
            console.log(`\n  Security Score: ${chalk[scoreColor](result.score + '/100')}`);
          }
        } else {
          output(opts.format, result);
        }

        await client.disconnect();
      } catch (error) {
        handleError(error);
      }
    });
}

/**
 * Format bytes to human readable
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

module.exports = { registerNetworkCommands };
