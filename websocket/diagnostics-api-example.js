/**
 * Diagnostics API Usage Examples
 *
 * This file demonstrates how to use the self-documenting API endpoints
 * to query the browser for help, documentation, and diagnostics information.
 *
 * The browser exposes several endpoints that don't require external documentation:
 * - /api/help - Browse all commands with descriptions
 * - /api/help?command=<name> - Get detailed info for a command
 * - /api/help?error=<code> - Get error details and recovery hints
 * - /api/help?search=<keyword> - Search commands
 * - /api/diagnostics - Browser health and capabilities
 * - /api/status - Current browser status
 * - /api/schema - OpenAPI schema for integration
 *
 * Usage:
 *
 * # Get all commands
 * curl http://localhost:8765/api/help
 *
 * # Get specific command help
 * curl http://localhost:8765/api/help?command=navigate
 * curl http://localhost:8765/api/help?command=click
 * curl http://localhost:8765/api/help?command=screenshot
 *
 * # Get error details
 * curl http://localhost:8765/api/help?error=INVALID_URL
 * curl http://localhost:8765/api/help?error=ELEMENT_NOT_FOUND
 * curl http://localhost:8765/api/help?error=TIMEOUT
 *
 * # Search for commands
 * curl http://localhost:8765/api/help?search=screenshot
 * curl http://localhost:8765/api/help?search=cookie
 * curl http://localhost:8765/api/help?search=proxy
 *
 * # Get browser diagnostics
 * curl http://localhost:8765/api/diagnostics
 *
 * # Get current status
 * curl http://localhost:8765/api/status
 *
 * # Get OpenAPI schema
 * curl http://localhost:8765/api/schema
 */

/**
 * Example: Discover available commands
 */
async function discoverCommands() {
  console.log('\n===== Discovering Available Commands =====\n');

  const response = await fetch('http://localhost:8765/api/help');
  const data = await response.json();

  console.log(`Total Commands: ${data.totalCommands}`);
  console.log(`Total Categories: ${data.totalCategories}`);
  console.log('\nCommand Categories:');

  Object.entries(data.commands).forEach(([category, commands]) => {
    console.log(`\n${category}:`);
    commands.slice(0, 3).forEach(cmd => {
      console.log(`  - ${cmd.command}: ${cmd.description}`);
    });
    if (commands.length > 3) {
      console.log(`  ... and ${commands.length - 3} more`);
    }
  });
}

/**
 * Example: Get detailed help for a specific command
 */
async function getCommandHelp(commandName) {
  console.log(`\n===== Help for Command: ${commandName} =====\n`);

  const response = await fetch(
    `http://localhost:8765/api/help?command=${commandName}`
  );

  if (response.status === 404) {
    console.log(`Error: Command '${commandName}' not found`);
    return;
  }

  const data = await response.json();

  console.log(`Command: ${data.command}`);
  console.log(`Category: ${data.category}`);
  console.log(`Description: ${data.description}`);

  if (data.required && data.required.length > 0) {
    console.log(`\nRequired Parameters: ${data.required.join(', ')}`);
  }

  if (data.parameters && Object.keys(data.parameters).length > 0) {
    console.log('\nParameter Details:');
    Object.entries(data.parameters).forEach(([name, def]) => {
      console.log(`  ${name}:`);
      console.log(`    Type: ${def.type}`);
      if (def.description) console.log(`    Description: ${def.description}`);
      if (def.default) console.log(`    Default: ${def.default}`);
      if (def.example) console.log(`    Example: ${def.example}`);
    });
  }

  if (data.examples && data.examples.length > 0) {
    console.log('\nExamples:');
    data.examples.forEach((example, i) => {
      console.log(`  ${i + 1}. ${example.description}`);
      console.log(`     Request: ${JSON.stringify(example.request)}`);
    });
  }

  if (data.errorCodes && data.errorCodes.length > 0) {
    console.log(`\nPossible Errors: ${data.errorCodes.join(', ')}`);
  }

  if (data.recoveryHints && Object.keys(data.recoveryHints).length > 0) {
    console.log('\nRecovery Hints:');
    Object.entries(data.recoveryHints).forEach(([errorCode, hint]) => {
      console.log(`  ${errorCode}: ${hint}`);
    });
  }
}

/**
 * Example: Get error details
 */
async function getErrorHelp(errorCode) {
  console.log(`\n===== Error Information: ${errorCode} =====\n`);

  const response = await fetch(
    `http://localhost:8765/api/help?error=${errorCode}`
  );

  if (response.status === 404) {
    console.log(`Error: Error code '${errorCode}' not found`);
    return;
  }

  const data = await response.json();

  console.log(`Error Code: ${data.errorCode}`);
  console.log(`Description: ${data.description}`);
  console.log(`Recovery Hint: ${data.recoveryHint}`);

  if (data.relatedErrors && data.relatedErrors.length > 0) {
    console.log(`Related Errors: ${data.relatedErrors.join(', ')}`);
  }
}

/**
 * Example: Search for commands
 */
async function searchCommands(keyword) {
  console.log(`\n===== Searching for: "${keyword}" =====\n`);

  const response = await fetch(
    `http://localhost:8765/api/help?search=${encodeURIComponent(keyword)}`
  );

  const data = await response.json();

  console.log(`Found ${data.resultCount} matching commands:\n`);

  data.results.forEach(cmd => {
    console.log(`- ${cmd.command} [${cmd.category}]`);
    console.log(`  ${cmd.description}\n`);
  });
}

/**
 * Example: Get browser diagnostics
 */
async function getDiagnostics() {
  console.log('\n===== Browser Diagnostics =====\n');

  const response = await fetch('http://localhost:8765/api/diagnostics');
  const data = await response.json();

  console.log(`Version: ${data.version}`);
  console.log(`Status: ${data.status}`);
  console.log(`Uptime: ${data.uptime.readable}`);

  console.log('\nSystem Information:');
  console.log(`  Platform: ${data.system.platform}`);
  console.log(`  Architecture: ${data.system.arch}`);
  console.log(`  CPUs: ${data.system.cpus}`);
  console.log(`  Node Version: ${data.system.nodeVersion}`);

  console.log('\nMemory Usage:');
  console.log(`  Heap Used: ${data.memory.heapUsed} (${data.memory.heapUsedPercent})`);
  console.log(`  Heap Total: ${data.memory.heapTotal}`);
  console.log(`  RSS: ${data.memory.rss}`);

  console.log('\nAPI Information:');
  console.log(`  Total Commands: ${data.api.totalCommands}`);
  console.log(`  Total Categories: ${data.api.totalCategories}`);
  console.log(`  Total Error Codes: ${data.api.errorCodes}`);

  console.log('\nFeatures:');
  Object.entries(data.features).forEach(([feature, supported]) => {
    console.log(`  ${feature}: ${supported ? 'YES' : 'NO'}`);
  });
}

/**
 * Example: Get current status
 */
async function getStatus() {
  console.log('\n===== Browser Status =====\n');

  const response = await fetch('http://localhost:8765/api/status');
  const data = await response.json();

  console.log(`Status: ${data.status}`);
  console.log(`Version: ${data.version}`);
  console.log(`Timestamp: ${data.timestamp}`);
  console.log(`Uptime: ${data.uptime}ms`);

  console.log('\nAvailable Endpoints:');
  Object.entries(data.endpoints).forEach(([name, url]) => {
    console.log(`  ${name}: ${url}`);
  });
}

/**
 * Example: Get OpenAPI schema
 */
async function getSchema() {
  console.log('\n===== OpenAPI Schema (First 50 lines) =====\n');

  const response = await fetch('http://localhost:8765/api/schema');
  const data = await response.json();

  const output = JSON.stringify(data, null, 2);
  const lines = output.split('\n').slice(0, 50);
  console.log(lines.join('\n'));
  console.log('\n... (truncated for brevity)');
}

/**
 * Example: Integration with external tools
 */
async function integrateWithTools() {
  console.log('\n===== Integration Example: Command Validation =====\n');

  // Get command help
  const response = await fetch('http://localhost:8765/api/help?command=navigate');
  const command = await response.json();

  // Show how to validate parameters before sending
  const testParams = { url: 'https://example.com', timeout: 30000 };

  console.log(`Command: ${command.command}`);
  console.log(`Test Parameters: ${JSON.stringify(testParams)}`);

  console.log('\nValidation:');
  command.required.forEach(param => {
    if (param in testParams) {
      console.log(`  ✓ Required parameter '${param}' is present`);
    } else {
      console.log(`  ✗ Missing required parameter: ${param}`);
    }
  });

  console.log('\nYou can now safely send this to the browser:');
  console.log(JSON.stringify({
    type: 'command',
    command: command.command,
    params: testParams
  }, null, 2));
}

/**
 * Main execution
 */
async function main() {
  try {
    // Uncomment examples to run:

    // await discoverCommands();
    // await getCommandHelp('navigate');
    // await getCommandHelp('click');
    // await getCommandHelp('screenshot');
    // await getErrorHelp('INVALID_URL');
    // await getErrorHelp('ELEMENT_NOT_FOUND');
    // await searchCommands('screenshot');
    // await searchCommands('cookie');
    // await getDiagnostics();
    // await getStatus();
    // await getSchema();
    // await integrateWithTools();

    // Run all examples by default
    console.log('\n' + '='.repeat(60));
    console.log('Basset Hound Browser - Self-Documenting API Examples');
    console.log('='.repeat(60));

    await discoverCommands();
    await getCommandHelp('navigate');
    await getErrorHelp('INVALID_URL');
    await searchCommands('screenshot');
    await getDiagnostics();
    await getStatus();
    await integrateWithTools();

    console.log('\n' + '='.repeat(60));
    console.log('Examples complete!');
    console.log('='.repeat(60) + '\n');
  } catch (error) {
    console.error('Error:', error.message);
    console.error('\nMake sure the browser is running on http://localhost:8765');
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = {
  discoverCommands,
  getCommandHelp,
  getErrorHelp,
  searchCommands,
  getDiagnostics,
  getStatus,
  getSchema,
  integrateWithTools
};
