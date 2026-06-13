/**
 * Input Validation Hardening Module
 *
 * Comprehensive input validation for all WebSocket and API requests
 * Implements schema validation, content-type checking, and security scanning
 *
 * Version: 1.0.0
 * Created: June 13, 2026
 */

const crypto = require('crypto');

/**
 * Input Validator - Multi-layer validation for security
 */
class InputValidator {
  constructor(options = {}) {
    this.maxPayloadSize = options.maxPayloadSize || 10 * 1024 * 1024; // 10MB
    this.maxStringLength = options.maxStringLength || 1024 * 1024; // 1MB
    this.maxArrayLength = options.maxArrayLength || 10000;
    this.enableXssProtection = options.enableXssProtection !== false;
    this.enableSqlInjectionProtection = options.enableSqlInjectionProtection !== false;
    this.enablePathTraversal = options.enablePathTraversal !== false;
    this.enableCommandInjection = options.enableCommandInjection !== false;

    // Dangerous patterns
    this.xssPatterns = [
      /<script[^>]*>[\s\S]*?<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<iframe[^>]*>/gi,
      /<object[^>]*>/gi,
      /<embed[^>]*>/gi
    ];

    this.sqlPatterns = [
      /('|(")|(%;)|(--|)|(\*\/)|(\*)|(\||)|(;)|(,))/gi,
      /(union|select|insert|update|delete|drop|create|alter|exec|script|javascript)/gi
    ];

    this.pathPatterns = [
      /\.\.\//g,
      /\.\.%2f/gi,
      /%2e%2e%2f/gi,
      /\.\.\\/g
    ];

    this.commandPatterns = [
      /[;&|`$(){}[\]<>^]/g,
      /(cat|wget|curl|nc|bash|sh|cmd|powershell)/gi
    ];

    // Schema definitions for commands
    this.commandSchemas = this.initializeCommandSchemas();

    // Content type whitelist
    this.allowedContentTypes = [
      'application/json',
      'application/x-www-form-urlencoded',
      'text/plain',
      'image/png',
      'image/jpeg',
      'image/gif',
      'image/webp'
    ];
  }

  /**
   * Initialize command-specific validation schemas
   */
  initializeCommandSchemas() {
    return {
      navigate: {
        url: { type: 'string', required: true, maxLength: 2048 },
        timeout: { type: 'number', required: false, min: 100, max: 300000 },
        waitUntil: { type: 'string', enum: ['load', 'domcontentloaded', 'networkidle'] }
      },
      fill: {
        selector: { type: 'string', required: true, maxLength: 512 },
        value: { type: 'string', required: true, maxLength: 10000 },
        delay: { type: 'number', required: false, min: 0, max: 5000 }
      },
      click: {
        selector: { type: 'string', required: true, maxLength: 512 },
        count: { type: 'number', required: false, min: 1, max: 100 },
        delay: { type: 'number', required: false, min: 0, max: 5000 }
      },
      type: {
        text: { type: 'string', required: true, maxLength: 10000 },
        delay: { type: 'number', required: false, min: 0, max: 500 }
      },
      execute_javascript: {
        script: { type: 'string', required: true, maxLength: 50000 },
        args: { type: 'array', required: false, maxLength: 100 }
      },
      screenshot: {
        format: { type: 'string', enum: ['png', 'jpeg'], required: false },
        quality: { type: 'number', required: false, min: 1, max: 100 },
        fullPage: { type: 'boolean', required: false }
      },
      get_content: {
        type: { type: 'string', enum: ['html', 'text', 'json'], required: false }
      },
      set_proxy: {
        type: { type: 'string', enum: ['http', 'https', 'socks4', 'socks5'], required: true },
        host: { type: 'string', required: true, maxLength: 255 },
        port: { type: 'number', required: true, min: 1, max: 65535 },
        username: { type: 'string', required: false, maxLength: 255 },
        password: { type: 'string', required: false, maxLength: 255 }
      }
    };
  }

  /**
   * Validate entire request
   */
  validateRequest(data) {
    const errors = [];

    if (!data || typeof data !== 'object') {
      return { valid: false, errors: ['Request must be a valid object'] };
    }

    // Check payload size
    const payloadSize = Buffer.byteLength(JSON.stringify(data));
    if (payloadSize > this.maxPayloadSize) {
      errors.push(`Payload size ${payloadSize} exceeds maximum ${this.maxPayloadSize}`);
    }

    // Validate required fields
    if (!data.command || typeof data.command !== 'string') {
      errors.push('Command is required and must be a string');
    }

    // Validate command name (alphanumeric + underscore only)
    if (data.command && !/^[a-z_][a-z0-9_]*$/i.test(data.command)) {
      errors.push('Command contains invalid characters');
    }

    // Validate parameters
    if (data.params && typeof data.params === 'object') {
      const paramErrors = this.validateParameters(data.command, data.params);
      errors.push(...paramErrors);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate command parameters against schema
   */
  validateParameters(command, params) {
    const errors = [];
    const schema = this.commandSchemas[command];

    if (!schema) {
      // No specific schema - just validate types
      return this.validateObjectTypes(params);
    }

    for (const [key, rule] of Object.entries(schema)) {
      const value = params[key];

      // Check required fields
      if (rule.required && value === undefined) {
        errors.push(`Parameter ${key} is required`);
        continue;
      }

      if (value === undefined || value === null) {
        continue;
      }

      // Validate type
      const valueType = Array.isArray(value) ? 'array' : typeof value;
      if (rule.type && valueType !== rule.type) {
        errors.push(`Parameter ${key} must be of type ${rule.type}, got ${valueType}`);
        continue;
      }

      // Validate string constraints
      if (typeof value === 'string') {
        if (rule.maxLength && value.length > rule.maxLength) {
          errors.push(`Parameter ${key} exceeds maximum length ${rule.maxLength}`);
        }
      }

      // Validate number constraints
      if (typeof value === 'number') {
        if (rule.min !== undefined && value < rule.min) {
          errors.push(`Parameter ${key} must be >= ${rule.min}`);
        }
        if (rule.max !== undefined && value > rule.max) {
          errors.push(`Parameter ${key} must be <= ${rule.max}`);
        }
      }

      // Validate enum values
      if (rule.enum && !rule.enum.includes(value)) {
        errors.push(`Parameter ${key} must be one of: ${rule.enum.join(', ')}`);
      }

      // Validate array length
      if (Array.isArray(value) && rule.maxLength && value.length > rule.maxLength) {
        errors.push(`Parameter ${key} array exceeds maximum length ${rule.maxLength}`);
      }
    }

    return errors;
  }

  /**
   * Validate object types recursively
   */
  validateObjectTypes(obj, depth = 0) {
    const errors = [];
    const maxDepth = 10;

    if (depth > maxDepth) {
      errors.push('Object nesting exceeds maximum depth');
      return errors;
    }

    if (typeof obj !== 'object' || obj === null) {
      return errors;
    }

    for (const [key, value] of Object.entries(obj)) {
      // Validate key (alphanumeric + underscore)
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
        errors.push(`Invalid object key: ${key}`);
        continue;
      }

      // Check string values for dangerous content
      if (typeof value === 'string') {
        if (value.length > this.maxStringLength) {
          errors.push(`String value for ${key} exceeds maximum length`);
        }
      }

      // Recursively validate nested objects
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        errors.push(...this.validateObjectTypes(value, depth + 1));
      }

      // Validate arrays
      if (Array.isArray(value)) {
        if (value.length > this.maxArrayLength) {
          errors.push(`Array ${key} exceeds maximum length`);
        }
      }
    }

    return errors;
  }

  /**
   * Detect XSS patterns
   */
  detectXss(value) {
    for (const pattern of this.xssPatterns) {
      if (pattern.test(value)) {
        return { detected: true, pattern: pattern.toString() };
      }
    }
    return { detected: false };
  }

  /**
   * Detect SQL injection patterns
   */
  detectSqlInjection(value) {
    for (const pattern of this.sqlPatterns) {
      if (pattern.test(value)) {
        return { detected: true, pattern: pattern.toString() };
      }
    }
    return { detected: false };
  }

  /**
   * Detect path traversal attempts
   */
  detectPathTraversal(path) {
    if (!this.enablePathTraversal) return { detected: false };

    for (const pattern of this.pathPatterns) {
      if (pattern.test(path)) {
        return { detected: true, pattern: pattern.toString() };
      }
    }
    return { detected: false };
  }

  /**
   * Detect command injection attempts
   */
  detectCommandInjection(value) {
    if (!this.enableCommandInjection) return { detected: false };

    for (const pattern of this.commandPatterns) {
      if (pattern.test(value)) {
        return { detected: true, pattern: pattern.toString() };
      }
    }
    return { detected: false };
  }

  /**
   * Validate file upload
   */
  validateFileUpload(file) {
    const errors = [];

    if (!file || typeof file !== 'object') {
      return { valid: false, errors: ['File must be an object'] };
    }

    // Validate filename
    if (!file.name || typeof file.name !== 'string') {
      errors.push('File name is required');
    } else {
      // Check for path traversal in filename
      const pathCheck = this.detectPathTraversal(file.name);
      if (pathCheck.detected) {
        errors.push('File name contains path traversal attempt');
      }

      // Check for dangerous extensions
      const dangerousExts = ['.exe', '.bat', '.sh', '.cmd', '.scr', '.pif', '.js', '.vbs'];
      const ext = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
      if (dangerousExts.includes(ext)) {
        errors.push(`File extension ${ext} is not allowed`);
      }
    }

    // Validate size
    if (typeof file.size !== 'number' || file.size <= 0) {
      errors.push('File size must be a positive number');
    } else if (file.size > this.maxPayloadSize) {
      errors.push(`File size ${file.size} exceeds maximum`);
    }

    // Validate mime type
    if (file.mimetype) {
      if (!this.allowedContentTypes.includes(file.mimetype)) {
        errors.push(`MIME type ${file.mimetype} is not allowed`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Sanitize string input (remove potentially dangerous content)
   */
  sanitizeString(value) {
    if (typeof value !== 'string') {
      return value;
    }

    // Remove null bytes
    let sanitized = value.replace(/\0/g, '');

    // Remove control characters (except whitespace)
    sanitized = sanitized.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');

    // Truncate to max length
    if (sanitized.length > this.maxStringLength) {
      sanitized = sanitized.substring(0, this.maxStringLength);
    }

    return sanitized;
  }

  /**
   * Validate content-type header
   */
  validateContentType(contentType) {
    if (!contentType) {
      return { valid: true, matches: null };
    }

    // Extract MIME type (before semicolon)
    const mimeType = contentType.split(';')[0].trim().toLowerCase();

    const isAllowed = this.allowedContentTypes.includes(mimeType);

    return {
      valid: isAllowed,
      matches: mimeType,
      allowed: this.allowedContentTypes
    };
  }

  /**
   * Get security report for input validation
   */
  getSecurityReport() {
    return {
      enabled: true,
      maxPayloadSize: this.maxPayloadSize,
      maxStringLength: this.maxStringLength,
      maxArrayLength: this.maxArrayLength,
      protections: {
        xss: this.enableXssProtection,
        sqlInjection: this.enableSqlInjectionProtection,
        pathTraversal: this.enablePathTraversal,
        commandInjection: this.enableCommandInjection
      },
      patterns: {
        xss: this.xssPatterns.length,
        sql: this.sqlPatterns.length,
        path: this.pathPatterns.length,
        command: this.commandPatterns.length
      },
      commandSchemas: Object.keys(this.commandSchemas).length,
      contentTypes: this.allowedContentTypes.length
    };
  }
}

module.exports = { InputValidator };
