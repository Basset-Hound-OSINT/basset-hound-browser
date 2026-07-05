/**
 * API Versioning Example - Using /api/v1/* and /api/v2/* endpoints
 *
 * This example demonstrates how to use the Basset Hound Browser's
 * versioned API endpoints with version negotiation.
 *
 * The browser provides two API versions:
 * - v1.0: Stable, basic self-documenting API
 * - v2.0: Enhanced version with deprecation info, telemetry, recommendations
 *
 * Version negotiation can be done via:
 * 1. URL prefix: /api/v1/* or /api/v2/*
 * 2. Accept-Version header: "Accept-Version: 2.0"
 * 3. Query parameter: ?apiVersion=1 or ?apiVersion=2
 */

const http = require('http');

/**
 * Helper function to make HTTP requests to the diagnostics API
 */
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const requestOptions = {
      hostname: urlObj.hostname || 'localhost',
      port: urlObj.port || 8765,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: options.headers || {}
    };

    const req = http.request(requestOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data ? JSON.parse(data) : null
        });
      });
    });

    req.on('error', reject);
    req.end();
  });
}

/**
 * Example 1: Using URL prefix for version specification
 *
 * The simplest way to use versioned endpoints is to include the version
 * in the URL path.
 */
async function example1_UrlPrefix() {
  console.log('\n=== Example 1: Using URL Prefix ===\n');

  try {
    // Get help from v1 API
    const v1Response = await makeRequest('http://localhost:8765/api/v1/help');
    console.log('V1 Help (URL: /api/v1/help)');
    console.log(`  Status: ${v1Response.statusCode}`);
    console.log(`  API Version: ${v1Response.headers['x-api-version']}`);
    console.log(`  Total Commands: ${v1Response.body.totalCommands}`);
    console.log(`  Categories: ${v1Response.body.totalCategories}`);

    // Get help from v2 API
    const v2Response = await makeRequest('http://localhost:8765/api/v2/help');
    console.log('\nV2 Help (URL: /api/v2/help)');
    console.log(`  Status: ${v2Response.statusCode}`);
    console.log(`  API Version: ${v2Response.headers['x-api-version']}`);
    console.log(`  Total Commands: ${v2Response.body.totalCommands}`);
    console.log(`  Has deprecations: ${!!v2Response.body.deprecations}`);
    console.log(`  Has version info: ${!!v2Response.body.versionInfo}`);

    if (v2Response.body.deprecations && v2Response.body.deprecations.length > 0) {
      console.log(`  Deprecated commands: ${v2Response.body.deprecations.length}`);
      v2Response.body.deprecations.forEach(cmd => {
        console.log(`    - ${cmd.command}: ${cmd.reason}`);
      });
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

/**
 * Example 2: Using Accept-Version header
 *
 * You can also specify the API version using the Accept-Version HTTP header.
 * This takes precedence over the URL prefix and query parameter.
 */
async function example2_AcceptVersionHeader() {
  console.log('\n=== Example 2: Using Accept-Version Header ===\n');

  try {
    // Request v2 API using header on legacy endpoint
    const response = await makeRequest('http://localhost:8765/api/diagnostics', {
      headers: {
        'Accept-Version': '2.0'
      }
    });

    console.log('Legacy /api/diagnostics with Accept-Version: 2.0');
    console.log(`  Status: ${response.statusCode}`);
    console.log(`  API Version: ${response.headers['x-api-version']}`);
    console.log(`  Response Time: ${response.headers['x-response-time-ms']}ms`);

    // Show V2-specific fields
    if (response.body.telemetry) {
      console.log(`  Telemetry (V2 feature): ${JSON.stringify(response.body.telemetry)}`);
    }
    if (response.body.recommendations) {
      console.log(`  Recommendations (V2 feature): ${response.body.recommendations.length} items`);
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

/**
 * Example 3: Using query parameter for version
 *
 * You can also specify the version via query parameter.
 * Priority: Header > URL Prefix > Query Parameter
 */
async function example3_QueryParameter() {
  console.log('\n=== Example 3: Using Query Parameter ===\n');

  try {
    // Request v2 API using query parameter on legacy endpoint
    const response = await makeRequest('http://localhost:8765/api/status?apiVersion=2');

    console.log('Legacy /api/status with ?apiVersion=2');
    console.log(`  Status: ${response.statusCode}`);
    console.log(`  API Version: ${response.headers['x-api-version']}`);
    console.log(`  Operational Status: ${response.body.status}`);
    console.log(`  Uptime: ${response.body.uptime}ms`);

    if (response.body.versionInfo) {
      console.log(`  Version Info (V2): ${response.body.versionInfo.version}`);
      console.log(`  Release Date: ${response.body.versionInfo.releaseDate}`);
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

/**
 * Example 4: Querying the version endpoint
 *
 * Use /api/version to get information about all supported API versions
 * and how to negotiate versions.
 */
async function example4_VersionEndpoint() {
  console.log('\n=== Example 4: Version Negotiation Endpoint ===\n');

  try {
    const response = await makeRequest('http://localhost:8765/api/version');

    console.log('GET /api/version');
    console.log(`  Current Browser Version: ${response.body.currentVersion}`);
    console.log(`  Default API Version: ${response.body.defaultVersion}`);
    console.log(`  Supported API Versions: ${response.body.apiVersions.length}`);

    console.log('\n  Available Versions:');
    response.body.apiVersions.forEach(version => {
      console.log(`    - ${version.version}: ${version.status} (released ${version.releaseDate})`);
    });

    console.log('\n  Version Negotiation Methods (in priority order):');
    response.body.versionNegotiation.methods.forEach(method => {
      console.log(`    ${method.priority}. ${method.method}: ${method.example}`);
    });

    console.log('\n  Available Endpoints:');
    const endpoints = response.body.endpoints;
    console.log(`    V1: ${Object.keys(endpoints.v1).join(', ')}`);
    console.log(`    V2: ${Object.keys(endpoints.v2).join(', ')}`);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

/**
 * Example 5: Getting diagnostics with version differences
 *
 * Compare the same endpoint across versions to see enhanced features.
 */
async function example5_VersionComparison() {
  console.log('\n=== Example 5: V1 vs V2 Diagnostics Comparison ===\n');

  try {
    const v1Response = await makeRequest('http://localhost:8765/api/v1/diagnostics');
    const v2Response = await makeRequest('http://localhost:8765/api/v2/diagnostics');

    console.log('V1 Diagnostics Response:');
    console.log(`  API Version: ${v1Response.body.apiVersion}`);
    console.log(`  Browser Version: ${v1Response.body.version}`);
    console.log(`  Status: ${v1Response.body.status}`);
    console.log(`  Uptime: ${v1Response.body.uptime.readable}`);
    console.log(`  Memory: ${v1Response.body.memory.heapUsedPercent}`);
    console.log(`  Has telemetry: ${!!v1Response.body.telemetry}`);
    console.log(`  Has recommendations: ${!!v1Response.body.recommendations}`);

    console.log('\nV2 Diagnostics Response:');
    console.log(`  API Version: ${v2Response.body.apiVersion}`);
    console.log(`  Browser Version: ${v2Response.body.version}`);
    console.log(`  Status: ${v2Response.body.status}`);
    console.log(`  Uptime: ${v2Response.body.uptime.readable}`);
    console.log(`  Memory: ${v2Response.body.memory.heapUsedPercent}`);
    console.log(`  Has telemetry: ${!!v2Response.body.telemetry}`);
    console.log(`  Has recommendations: ${!!v2Response.body.recommendations}`);

    if (v2Response.body.recommendations) {
      console.log(`  Recommendations (V2 feature):`);
      v2Response.body.recommendations.forEach(rec => {
        console.log(`    - ${rec.severity}: ${rec.recommendation}`);
      });
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

/**
 * Example 6: Getting specific command help with versioning
 *
 * Query a specific command and see version-specific details.
 */
async function example6_CommandHelp() {
  console.log('\n=== Example 6: Command Help with Versioning ===\n');

  try {
    // Get navigate command from v1
    const v1Cmd = await makeRequest('http://localhost:8765/api/v1/help?command=navigate');
    console.log('V1 Help for "navigate" command:');
    if (v1Cmd.statusCode === 200) {
      console.log(`  Command: ${v1Cmd.body.command}`);
      console.log(`  Category: ${v1Cmd.body.category}`);
      console.log(`  Description: ${v1Cmd.body.description}`);
      console.log(`  Parameters: ${Object.keys(v1Cmd.body.parameters || {}).join(', ')}`);
    } else {
      console.log(`  Command not found (HTTP ${v1Cmd.statusCode})`);
    }

    // Get same command from v2
    const v2Cmd = await makeRequest('http://localhost:8765/api/v2/help?command=navigate');
    console.log('\nV2 Help for "navigate" command:');
    if (v2Cmd.statusCode === 200) {
      console.log(`  Command: ${v2Cmd.body.command}`);
      console.log(`  Category: ${v2Cmd.body.category}`);
      console.log(`  Description: ${v2Cmd.body.description}`);
      console.log(`  Parameters: ${Object.keys(v2Cmd.body.parameters || {}).join(', ')}`);
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

/**
 * Example 7: Schema endpoint with versioning
 *
 * Get OpenAPI-compatible schema with version-specific fields.
 */
async function example7_SchemaComparison() {
  console.log('\n=== Example 7: Schema with Versioning ===\n');

  try {
    const v1Schema = await makeRequest('http://localhost:8765/api/v1/schema');
    console.log('V1 Schema:');
    console.log(`  OpenAPI Version: ${v1Schema.body.openapi}`);
    console.log(`  Title: ${v1Schema.body.info.title}`);
    console.log(`  API Version (x-api-version): ${v1Schema.body.info['x-api-version']}`);
    console.log(`  Has x-version-info: ${!!v1Schema.body['x-version-info']}`);
    console.log(`  Has x-deprecated-commands: ${!!v1Schema.body['x-deprecated-commands']}`);
    console.log(`  Paths defined: ${Object.keys(v1Schema.body.paths).length}`);

    const v2Schema = await makeRequest('http://localhost:8765/api/v2/schema');
    console.log('\nV2 Schema:');
    console.log(`  OpenAPI Version: ${v2Schema.body.openapi}`);
    console.log(`  Title: ${v2Schema.body.info.title}`);
    console.log(`  API Version (x-api-version): ${v2Schema.body.info['x-api-version']}`);
    console.log(`  Has x-version-info: ${!!v2Schema.body['x-version-info']}`);
    console.log(`  Has x-deprecated-commands: ${!!v2Schema.body['x-deprecated-commands']}`);
    console.log(`  Paths defined: ${Object.keys(v2Schema.body.paths).length}`);

    if (v2Schema.body['x-deprecated-commands']) {
      console.log(`\n  Deprecated commands in V2 schema:`);
      v2Schema.body['x-deprecated-commands'].forEach(cmd => {
        console.log(`    - ${cmd.command} -> ${cmd.alternative}`);
      });
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

/**
 * Run all examples
 */
async function runAllExamples() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     Basset Hound Browser - API Versioning Examples        ║');
  console.log('║                                                            ║');
  console.log('║  Demonstrates /api/v1/* and /api/v2/* endpoints          ║');
  console.log('║  with version negotiation via header, URL, and query     ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  try {
    await example1_UrlPrefix();
    await example2_AcceptVersionHeader();
    await example3_QueryParameter();
    await example4_VersionEndpoint();
    await example5_VersionComparison();
    await example6_CommandHelp();
    await example7_SchemaComparison();

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                    All examples completed                 ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
  } catch (error) {
    console.error('Fatal error:', error.message);
    process.exit(1);
  }
}

// Export functions for use as module
module.exports = {
  example1_UrlPrefix,
  example2_AcceptVersionHeader,
  example3_QueryParameter,
  example4_VersionEndpoint,
  example5_VersionComparison,
  example6_CommandHelp,
  example7_SchemaComparison,
  runAllExamples
};

// Run if executed directly
if (require.main === module) {
  runAllExamples();
}
