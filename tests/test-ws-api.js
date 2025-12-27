/**
 * Test script for Basset Hound Browser WebSocket API
 *
 * Usage: node test-ws-api.js
 *
 * Requires the browser to be running: npm start
 */

const WebSocket = require('ws');

const WS_URL = 'ws://localhost:8765';
let messageId = 0;

function generateId() {
    return `test-${++messageId}-${Date.now()}`;
}

async function sendCommand(ws, command, params = {}) {
    return new Promise((resolve, reject) => {
        const id = generateId();
        const message = {
            type: 'command',
            id,
            command,
            ...params
        };

        const timeout = setTimeout(() => {
            reject(new Error(`Timeout waiting for response to ${command}`));
        }, 10000);

        const handler = (data) => {
            const response = JSON.parse(data.toString());
            if (response.id === id) {
                clearTimeout(timeout);
                ws.off('message', handler);
                if (response.success) {
                    resolve(response.result);
                } else {
                    reject(new Error(response.error || 'Command failed'));
                }
            }
        };

        ws.on('message', handler);
        ws.send(JSON.stringify(message));
        console.log(`[Sent] ${command}:`, params);
    });
}

async function runTests() {
    console.log('='.repeat(50));
    console.log('  Basset Hound Browser WebSocket API Test');
    console.log('='.repeat(50));
    console.log();

    const ws = new WebSocket(WS_URL);

    try {
        await new Promise((resolve, reject) => {
            ws.on('open', () => {
                console.log('[Connected] WebSocket connected to', WS_URL);
                resolve();
            });
            ws.on('error', reject);
            setTimeout(() => reject(new Error('Connection timeout')), 5000);
        });

        // Wait for initial messages
        await new Promise(resolve => {
            ws.once('message', (data) => {
                const msg = JSON.parse(data.toString());
                console.log('[Received] Connection message:', msg.message || msg.type);
                resolve();
            });
        });

        // Test 1: Get tabs
        console.log('\n[Test 1] Get tabs...');
        const tabsResult = await sendCommand(ws, 'getTabs');
        console.log('[Result] Tabs:', tabsResult.tabs?.length || 0, 'tabs');

        // Test 2: Navigate
        console.log('\n[Test 2] Navigate to example.com...');
        const navResult = await sendCommand(ws, 'navigate', { url: 'https://example.com' });
        console.log('[Result] Navigate:', navResult);

        // Wait for page load
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Test 3: Get page state
        console.log('\n[Test 3] Get page state...');
        const stateResult = await sendCommand(ws, 'getPageState');
        console.log('[Result] Page state:', {
            url: stateResult.url,
            title: stateResult.title,
            isLoading: stateResult.isLoading
        });

        // Test 4: Execute script
        console.log('\n[Test 4] Execute script...');
        const scriptResult = await sendCommand(ws, 'executeScript', {
            code: 'document.title'
        });
        console.log('[Result] Page title:', scriptResult.returnValue);

        // Test 5: Screenshot
        console.log('\n[Test 5] Take screenshot...');
        const screenshotResult = await sendCommand(ws, 'screenshot');
        console.log('[Result] Screenshot:', {
            format: screenshotResult.format,
            dataSize: (screenshotResult.data?.length || 0) + ' bytes (base64)'
        });

        // Test 6: Wait for selector
        console.log('\n[Test 6] Wait for selector (h1)...');
        const waitSelectorResult = await sendCommand(ws, 'waitForSelector', { selector: 'h1', timeout: 5000 });
        console.log('[Result] Wait for selector:', waitSelectorResult);

        // Test 7: New tab and switch
        console.log('\n[Test 7] Create new tab...');
        const newTabResult = await sendCommand(ws, 'newTab', { url: 'https://www.google.com' });
        console.log('[Result] New tab:', newTabResult);

        // Wait for new tab to load
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Test 8: Get tabs (should be 2 now)
        console.log('\n[Test 8] Get tabs (should be 2)...');
        const tabsResult2 = await sendCommand(ws, 'getTabs');
        console.log('[Result] Tabs:', tabsResult2.tabs?.length || 0, 'tabs');

        // Get tab IDs
        const tab1Id = tabsResult2.tabs?.find(t => t.url.includes('example.com'))?.id;
        const tab2Id = tabsResult2.tabs?.find(t => t.url.includes('google.com'))?.id;

        // Test 9: Switch tab
        if (tab1Id) {
            console.log('\n[Test 9] Switch to first tab...');
            const switchResult = await sendCommand(ws, 'switchTab', { tabId: tab1Id });
            console.log('[Result] Switch tab:', switchResult);
        } else {
            console.log('\n[Test 9] Skipped - could not find tab');
        }

        // Test 10: Reload
        console.log('\n[Test 10] Reload page...');
        const reloadResult = await sendCommand(ws, 'reload');
        console.log('[Result] Reload:', reloadResult);

        // Wait for reload
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Test 11: Wait for navigation (should return quickly since already loaded)
        console.log('\n[Test 11] Wait for navigation...');
        const waitNavResult = await sendCommand(ws, 'waitForNavigation', { timeout: 5000 });
        console.log('[Result] Wait for navigation:', waitNavResult);

        // Test 12: Navigate to build history for goBack test
        console.log('\n[Test 12] Navigate to another page for history...');
        await sendCommand(ws, 'navigate', { url: 'https://httpbin.org/html' });
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Test 13: Go back
        console.log('\n[Test 13] Go back...');
        const goBackResult = await sendCommand(ws, 'goBack');
        console.log('[Result] Go back:', goBackResult);

        // Wait for navigation
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Test 14: Go forward
        console.log('\n[Test 14] Go forward...');
        const goForwardResult = await sendCommand(ws, 'goForward');
        console.log('[Result] Go forward:', goForwardResult);

        // Test 15: Close tab (close the second tab if it exists)
        if (tab2Id) {
            console.log('\n[Test 15] Close tab...');
            const closeResult = await sendCommand(ws, 'closeTab', { tabId: tab2Id });
            console.log('[Result] Close tab:', closeResult);
        } else {
            console.log('\n[Test 15] Skipped - no second tab to close');
        }

        // Test 16: Final tab count
        console.log('\n[Test 16] Final tab count...');
        const finalTabs = await sendCommand(ws, 'getTabs');
        console.log('[Result] Final tabs:', finalTabs.tabs?.length || 0, 'tabs');

        console.log('\n' + '='.repeat(50));
        console.log('  All tests passed!');
        console.log('='.repeat(50));

    } catch (err) {
        console.error('\n[Error]', err.message);
        process.exit(1);
    } finally {
        ws.close();
    }
}

runTests().catch(console.error);
