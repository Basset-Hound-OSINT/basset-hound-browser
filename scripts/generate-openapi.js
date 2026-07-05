#!/usr/bin/env node

/**
 * OpenAPI Schema Generator
 *
 * Generates OpenAPI 3.0 schema files (JSON and YAML) from the command registry.
 * These files are gitignored but useful for:
 * - API documentation tools (SwaggerUI, ReDoc)
 * - Code generation (swagger-codegen, openapi-generator)
 * - API testing frameworks (Postman, SoapUI)
 *
 * Usage:
 *   node scripts/generate-openapi.js              # Generate both JSON and YAML
 *   node scripts/generate-openapi.js --json-only  # Generate only JSON
 *   node scripts/generate-openapi.js --yaml-only  # Generate only YAML
 *   node scripts/generate-openapi.js --validate   # Validate generated schema
 *
 * @module scripts/generate-openapi
 */

const fs = require('fs');
const path = require('path');

// Parse command-line arguments
const args = process.argv.slice(2);
const jsonOnly = args.includes('--json-only');
const yamlOnly = args.includes('--yaml-only');
const validate = args.includes('--validate');
const verbose = args.includes('--verbose') || args.includes('-v');

const projectRoot = path.join(__dirname, '..');
const docsDir = path.join(projectRoot, 'docs');
const websocketDir = path.join(projectRoot, 'websocket');

// Try to load the HelpServer module
let HelpServer;
try {
  const helpServerPath = path.join(websocketDir, 'help-server.js');
  if (!fs.existsSync(helpServerPath)) {
    throw new Error('help-server.js not found');
  }
  HelpServer = require(helpServerPath).HelpServer;
  if (verbose) console.log('[INFO] Loaded HelpServer module');
} catch (error) {
  console.error(`[ERROR] Failed to load HelpServer: ${error.message}`);
  console.error('[INFO] Attempting fallback schema generation...');
  HelpServer = null;
}

/**
 * Generate OpenAPI schema using HelpServer if available
 */
function generateOpenApiSchema() {
  if (!HelpServer) {
    if (verbose) console.log('[WARN] HelpServer not available, using minimal schema');
    return generateMinimalSchema();
  }

  try {
    const helpServer = new HelpServer({
      version: require(path.join(projectRoot, 'package.json')).version || '12.10.0',
      logger: verbose ? console : {
        info: () => {},
        error: (msg) => console.error(msg),
        warn: (msg) => console.warn(msg),
        debug: () => {}
      }
    });

    if (verbose) console.log('[INFO] Generating OpenAPI schema...');
    const schema = helpServer._generateOpenApiSchema();

    if (verbose) console.log(`[INFO] Generated schema with ${Object.keys(schema.paths || {}).length} paths`);
    return schema;
  } catch (error) {
    console.error(`[ERROR] Failed to generate schema: ${error.message}`);
    return generateMinimalSchema();
  }
}

/**
 * Minimal fallback schema when HelpServer is unavailable
 */
function generateMinimalSchema() {
  return {
    openapi: '3.0.0',
    info: {
      title: 'Basset Hound Browser WebSocket API',
      version: require(path.join(projectRoot, 'package.json')).version || '12.10.0',
      description: 'Self-documenting browser automation and forensic capture API',
      contact: {
        name: 'API Support',
        url: 'http://localhost:8765/api/help'
      }
    },
    servers: [
      {
        url: 'ws://localhost:8765',
        description: 'WebSocket server (non-SSL)'
      },
      {
        url: 'wss://localhost:8765',
        description: 'WebSocket server (SSL/TLS)'
      }
    ],
    paths: {}
  };
}

/**
 * Convert JSON to YAML format
 */
function jsonToYaml(obj, indent = 0) {
  const indentStr = ' '.repeat(indent);
  let yaml = '';

  if (typeof obj === 'string') {
    if (obj.includes(':') || obj.includes('#') || obj.includes('\n') || obj.includes('"')) {
      yaml += `'${obj.replace(/'/g, "''")}'`;
    } else {
      yaml += obj;
    }
  } else if (typeof obj === 'number' || typeof obj === 'boolean') {
    yaml += obj.toString();
  } else if (obj === null) {
    yaml += 'null';
  } else if (Array.isArray(obj)) {
    if (obj.length === 0) {
      yaml += '[]';
    } else {
      yaml += '\n';
      obj.forEach((item, idx) => {
        yaml += indentStr + '- ';
        const itemYaml = jsonToYaml(item, 0);
        if (itemYaml.startsWith('\n')) {
          yaml += itemYaml.substring(1);
        } else {
          yaml += itemYaml;
        }
        if (idx < obj.length - 1) yaml += '\n';
      });
    }
  } else if (typeof obj === 'object') {
    yaml += '\n';
    const keys = Object.keys(obj);
    keys.forEach((key, idx) => {
      yaml += `${indentStr}${key}: `;
      const valYaml = jsonToYaml(obj[key], indent + 2);
      if (valYaml.startsWith('\n')) {
        yaml += valYaml;
      } else {
        yaml += valYaml;
      }
      if (idx < keys.length - 1) yaml += '\n';
    });
  }

  return yaml;
}

/**
 * Validate OpenAPI schema
 */
function validateSchema(schema) {
  const errors = [];

  // Check required fields
  if (!schema.openapi) errors.push('Missing required field: openapi');
  if (!schema.info) errors.push('Missing required field: info');
  if (!schema.info.title) errors.push('Missing required field: info.title');
  if (!schema.info.version) errors.push('Missing required field: info.version');
  if (!schema.servers) errors.push('Missing required field: servers');

  // Validate OpenAPI version
  if (schema.openapi && !schema.openapi.startsWith('3.')) {
    errors.push(`Invalid OpenAPI version: ${schema.openapi} (expected 3.x)`);
  }

  // Validate paths structure
  if (schema.paths) {
    Object.entries(schema.paths).forEach(([path, pathItem]) => {
      if (!pathItem.post && !pathItem.get && !pathItem.put && !pathItem.delete) {
        errors.push(`Path ${path} has no operations`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Save schema to file
 */
function saveSchema(filename, content, format = 'json') {
  try {
    fs.writeFileSync(filename, content, 'utf-8');
    const size = (fs.statSync(filename).size / 1024).toFixed(2);
    console.log(`✓ Generated ${format.toUpperCase()}: ${filename} (${size} KB)`);
    return true;
  } catch (error) {
    console.error(`✗ Failed to save ${filename}: ${error.message}`);
    return false;
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('='.repeat(70));
  console.log('OpenAPI Schema Generator');
  console.log('='.repeat(70));

  try {
    // Generate schema
    const schema = generateOpenApiSchema();

    // Validate schema
    if (validate) {
      if (verbose) console.log('[INFO] Validating schema...');
      const validation = validateSchema(schema);

      if (!validation.valid) {
        console.error('[ERROR] Schema validation failed:');
        validation.errors.forEach((error) => {
          console.error(`  - ${error}`);
        });
        process.exit(1);
      } else {
        console.log('[OK] Schema validation passed');
      }
    }

    let fileSaved = false;

    // Save JSON schema
    if (!yamlOnly) {
      const jsonPath = path.join(projectRoot, 'openapi.json');
      const jsonContent = JSON.stringify(schema, null, 2);
      if (saveSchema(jsonPath, jsonContent, 'json')) {
        fileSaved = true;
      }
    }

    // Save YAML schema
    if (!jsonOnly) {
      const yamlPath = path.join(projectRoot, 'openapi.yaml');
      const yamlContent = jsonToYaml(schema);
      if (saveSchema(yamlPath, yamlContent, 'yaml')) {
        fileSaved = true;
      }
    }

    if (!fileSaved) {
      process.exit(1);
    }

    console.log('='.repeat(70));
    console.log('Schema Generation Complete!');
    console.log('');
    console.log('Files are gitignored (see .gitignore)');
    console.log('');
    console.log('View with:');
    console.log('  - SwaggerUI:  docker run -p 8080:8080 -e SWAGGER_JSON=http://host.docker.internal:8765/api/openapi swaggerapi/swagger-ui');
    console.log('  - ReDoc:      docker run -p 8080:80 -e SPEC_URL=http://host.docker.internal:8765/api/openapi.yaml redocly/redoc');
    console.log('');
    console.log('Validate with:');
    console.log('  - npm install -g openapi-validator');
    console.log('  - openapi-validator openapi.json');
    console.log('='.repeat(70));

  } catch (error) {
    console.error(`[FATAL] ${error.message}`);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  generateOpenApiSchema,
  jsonToYaml,
  validateSchema,
  saveSchema
};
