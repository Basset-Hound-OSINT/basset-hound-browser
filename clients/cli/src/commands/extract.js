/**
 * Content extraction commands for CLI
 */

const ora = require('ora');
const chalk = require('chalk');
const { createClient, output, handleError } = require('../utils/client');

function registerExtractCommands(program) {
  // Extract command with subcommands
  const extract = program
    .command('extract [type]')
    .description('Extract content from page (metadata, links, forms, images, scripts, structured, all)')
    .option('--no-external', 'Exclude external links')
    .option('--no-lazy', 'Exclude lazy-loaded images')
    .action(async (type, options) => {
      const opts = program.opts();
      const extractType = type || 'all';
      const spinner = opts.quiet ? null : ora(`Extracting ${extractType}...`).start();

      try {
        const client = await createClient(opts);
        let result;

        switch (extractType) {
          case 'metadata':
          case 'meta':
            result = await client.sendCommand('extract_metadata');
            break;

          case 'links':
            result = await client.sendCommand('extract_links', {
              includeExternal: options.external
            });
            break;

          case 'forms':
            result = await client.sendCommand('extract_forms');
            break;

          case 'images':
          case 'imgs':
            result = await client.sendCommand('extract_images', {
              includeLazy: options.lazy
            });
            break;

          case 'scripts':
          case 'js':
            result = await client.sendCommand('extract_scripts');
            break;

          case 'structured':
          case 'jsonld':
            result = await client.sendCommand('extract_structured_data');
            break;

          case 'all':
          default:
            result = await client.sendCommand('extract_all');
            break;
        }

        if (spinner) spinner.succeed(`Extracted ${extractType}`);
        output(opts.format, result);
        await client.disconnect();
      } catch (error) {
        if (spinner) spinner.fail('Extraction failed');
        handleError(error);
      }
    });

  // Detect technologies command
  program
    .command('detect')
    .alias('technologies')
    .description('Detect technologies used on the page')
    .action(async () => {
      const opts = program.opts();
      const spinner = opts.quiet ? null : ora('Detecting technologies...').start();

      try {
        const client = await createClient(opts);
        const result = await client.sendCommand('detect_technologies');

        if (spinner) spinner.succeed('Technology detection complete');

        if (opts.format === 'plain' && result.technologies) {
          console.log(chalk.cyan('\nDetected Technologies:'));
          result.technologies.forEach(tech => {
            console.log(`  ${chalk.green('•')} ${tech.name} ${tech.version ? `(${tech.version})` : ''}`);
            if (tech.categories) {
              console.log(`    ${chalk.gray('Categories:')} ${tech.categories.join(', ')}`);
            }
          });
        } else {
          output(opts.format, result);
        }

        await client.disconnect();
      } catch (error) {
        if (spinner) spinner.fail('Detection failed');
        handleError(error);
      }
    });

  // Technology info command
  program
    .command('tech-info <name>')
    .description('Get information about a specific technology')
    .action(async (name) => {
      const opts = program.opts();

      try {
        const client = await createClient(opts);
        const result = await client.sendCommand('get_technology_info', { name });
        output(opts.format, result);
        await client.disconnect();
      } catch (error) {
        handleError(error);
      }
    });

  // Technology categories command
  program
    .command('tech-categories')
    .description('List technology categories')
    .action(async () => {
      const opts = program.opts();

      try {
        const client = await createClient(opts);
        const result = await client.sendCommand('get_technology_categories');
        output(opts.format, result);
        await client.disconnect();
      } catch (error) {
        handleError(error);
      }
    });

  // Search technologies command
  program
    .command('tech-search <query>')
    .description('Search for technologies')
    .action(async (query) => {
      const opts = program.opts();

      try {
        const client = await createClient(opts);
        const result = await client.sendCommand('search_technologies', { query });
        output(opts.format, result);
        await client.disconnect();
      } catch (error) {
        handleError(error);
      }
    });
}

module.exports = { registerExtractCommands };
