#!/usr/bin/env node

/**
 * Start WebSocket Server for Testing
 * Minimal setup without Electron
 */

// Mock electron ipcMain before loading WebSocketServer
const EventEmitter = require('events');

class MockIpcMain extends EventEmitter {
  constructor() {
    super();
    this.listeners = new Map();
  }

  on(channel, listener) {
    if (!this.listeners.has(channel)) {
      this.listeners.set(channel, []);
    }
    this.listeners.get(channel).push(listener);
    return this;
  }

  removeListener(channel, listener) {
    if (this.listeners.has(channel)) {
      const listeners = this.listeners.get(channel);
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
    return this;
  }

  once(channel, listener) {
    const wrappedListener = (...args) => {
      listener(...args);
      this.removeListener(channel, wrappedListener);
    };
    return this.on(channel, wrappedListener);
  }
}

// Override require for electron module
const Module = require('module');
const originalRequire = Module.prototype.require;

Module.prototype.require = function(id) {
  if (id === 'electron') {
    return {
      ipcMain: new MockIpcMain(),
      app: {
        getPath: () => '/tmp'
      }
    };
  }
  return originalRequire.apply(this, arguments);
};

const WebSocketServer = require('./websocket/server');

// Create a mock mainWindow object to satisfy WebSocketServer constructor
const mockWebContents = {
  send: (channel, data) => {
    console.log(`[Mock] IPC send: ${channel}`);
  },
  on: () => {},
  once: () => {}
};

const mockMainWindow = {
  webContents: mockWebContents,
  on: () => {},
  once: () => {}
};

async function startServer() {
  try {
    console.log('[TestServer] Starting WebSocket server...');

    const server = new WebSocketServer(8765, mockMainWindow, {
      enableDebug: false,
      enableProfiling: false,
      requireAuth: false,
      rateLimitEnabled: false
    });

    server.start();

    console.log('[TestServer] Server started on ws://localhost:8765');
    console.log('[TestServer] Ready to accept connections');

    // Keep server running
    process.on('SIGINT', async () => {
      console.log('[TestServer] Shutting down...');
      server.close();
      process.exit(0);
    });

  } catch (error) {
    console.error('[TestServer] Fatal error:', error);
    process.exit(1);
  }
}

startServer();
