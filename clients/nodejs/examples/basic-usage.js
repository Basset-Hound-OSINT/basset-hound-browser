/**
 * Basic usage example for Basset Hound Browser Node.js client
 */

const { BassetHoundClient } = require('../src');

async function main() {
  // Create client instance
  const client = new BassetHoundClient({
    host: 'localhost',
    port: 8765,
    commandTimeout: 30000
  });

  try {
    // Connect to browser
    console.log('Connecting to browser...');
    await client.connect();
    console.log('Connected!');

    // Navigate to a page
    console.log('\nNavigating to example.com...');
    await client.navigate('https://example.com');

    // Get page info
    const title = await client.getTitle();
    const url = await client.getUrl();
    console.log(`Title: ${title}`);
    console.log(`URL: ${url}`);

    // Extract metadata
    console.log('\nExtracting metadata...');
    const metadata = await client.extractMetadata();
    console.log('Metadata:', JSON.stringify(metadata, null, 2));

    // Extract links
    console.log('\nExtracting links...');
    const links = await client.extractLinks();
    console.log(`Found ${links.links?.length || 0} links`);

    // Detect technologies
    console.log('\nDetecting technologies...');
    const technologies = await client.detectTechnologies();
    console.log('Technologies:', JSON.stringify(technologies, null, 2));

    // Take a screenshot
    console.log('\nTaking screenshot...');
    await client.saveScreenshot('example-screenshot.png');
    console.log('Screenshot saved!');

    // Network capture example
    console.log('\nStarting network capture...');
    await client.startNetworkCapture();

    // Navigate to another page
    await client.navigate('https://httpbin.org/get');

    // Get network statistics
    const stats = await client.getNetworkStatistics();
    console.log('Network stats:', JSON.stringify(stats, null, 2));

    // Stop capture
    await client.stopNetworkCapture();

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    // Disconnect
    await client.disconnect();
    console.log('\nDisconnected.');
  }
}

// Event listeners example
function withEvents() {
  const client = new BassetHoundClient({
    autoReconnect: true,
    maxReconnectAttempts: 3
  });

  client.on('connected', () => {
    console.log('Event: Connected');
  });

  client.on('disconnected', ({ code, reason }) => {
    console.log(`Event: Disconnected (${code}: ${reason})`);
  });

  client.on('reconnecting', (attempt) => {
    console.log(`Event: Reconnecting (attempt ${attempt})`);
  });

  client.on('error', (error) => {
    console.log(`Event: Error - ${error.message}`);
  });

  client.on('message', (message) => {
    console.log('Event: Message received');
  });

  return client;
}

// Run example
main().catch(console.error);
