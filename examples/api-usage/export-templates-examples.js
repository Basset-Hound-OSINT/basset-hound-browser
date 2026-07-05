/**
 * Export Templates Examples
 *
 * Feature Area: Export & Analysis - Category 2
 *
 * Demonstrates usage of the export template engine for:
 * - Creating custom export templates
 * - Applying field mappings and transformations
 * - Using conditional exports
 * - Exporting data in different formats
 *
 * @module examples/export-templates-examples
 */

const { ExportTemplateEngine } = require('../extraction/export-templates');

/**
 * Example 1: Basic User Export Template
 * Create a template to export user data with field mapping
 */
function example1_BasicUserExport() {
  console.log('\n=== Example 1: Basic User Export ===\n');

  const engine = new ExportTemplateEngine();

  // Create template
  const template = engine.createTemplate({
    name: 'User Export',
    description: 'Basic user data export with field mapping',
    format: 'json',
    fields: [
      { source: 'userId', target: 'id' },
      { source: 'firstName', target: 'first_name' },
      { source: 'lastName', target: 'last_name' },
      { source: 'email', target: 'email_address' }
    ]
  });

  console.log('Created template:', template.name);
  console.log('Template ID:', template.id);

  // Sample data
  const data = {
    userId: 'user-123',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com'
  };

  // Export with template
  const result = engine.exportWithTemplate(template.id, data);
  console.log('\nExported data:');
  console.log(JSON.stringify(result.data, null, 2));
}

/**
 * Example 2: Template with Data Transformations
 * Apply transformations to normalize data during export
 */
function example2_DataTransformations() {
  console.log('\n=== Example 2: Data Transformations ===\n');

  const engine = new ExportTemplateEngine();

  // Create template with transforms
  const template = engine.createTemplate({
    name: 'Normalized Export',
    description: 'Export with data transformations',
    format: 'json',
    fields: [
      {
        source: 'id',
        target: 'id'
      },
      {
        source: 'name',
        target: 'name',
        transforms: ['trim', 'uppercase']
      },
      {
        source: 'email',
        target: 'email',
        transforms: ['trim', 'lowercase']
      },
      {
        source: 'joinDate',
        target: 'joined',
        transforms: ['toISOString']
      },
      {
        source: 'score',
        target: 'rating',
        transforms: [{ name: 'round', args: [2] }]
      }
    ]
  });

  // Sample data
  const data = {
    id: 1,
    name: '  john doe  ',
    email: '  JOHN@EXAMPLE.COM  ',
    joinDate: new Date('2024-01-15'),
    score: 4.567890
  };

  // Export
  const result = engine.exportWithTemplate(template.id, data);
  console.log('Original data:');
  console.log(JSON.stringify(data, null, 2));
  console.log('\nTransformed data:');
  console.log(JSON.stringify(result.data, null, 2));
}

/**
 * Example 3: Conditional Field Export
 * Include/exclude fields based on data conditions
 */
function example3_ConditionalExports() {
  console.log('\n=== Example 3: Conditional Exports ===\n');

  const engine = new ExportTemplateEngine();

  // Create template with conditions
  const template = engine.createTemplate({
    name: 'Conditional User Export',
    description: 'Conditional field inclusion based on user status',
    format: 'json',
    fields: [
      { source: 'id', target: 'id' },
      { source: 'name', target: 'name' },
      { source: 'email', target: 'email' },
      {
        source: 'subscription',
        target: 'subscription',
        condition: { field: 'status', operator: 'equals', value: 'active' }
      },
      {
        source: 'premiumFeatures',
        target: 'features',
        condition: { field: 'plan', operator: 'in', value: ['premium', 'enterprise'] }
      },
      {
        source: 'registeredAt',
        target: 'registered_date',
        condition: { field: 'verified', operator: 'exists' }
      }
    ]
  });

  // Test with active user
  const activeUser = {
    id: 1,
    name: 'John',
    email: 'john@example.com',
    status: 'active',
    plan: 'premium',
    subscription: { type: 'monthly' },
    premiumFeatures: ['export', 'analytics'],
    verified: true,
    registeredAt: new Date()
  };

  console.log('Active Premium User:');
  let result = engine.exportWithTemplate(template.id, activeUser);
  console.log(JSON.stringify(result.data, null, 2));

  // Test with inactive user
  const inactiveUser = {
    id: 2,
    name: 'Jane',
    email: 'jane@example.com',
    status: 'inactive',
    plan: 'free'
  };

  console.log('\nInactive Free User:');
  result = engine.exportWithTemplate(template.id, inactiveUser);
  console.log(JSON.stringify(result.data, null, 2));
}

/**
 * Example 4: Batch Export with Array Data
 * Export multiple records using same template
 */
function example4_BatchExport() {
  console.log('\n=== Example 4: Batch Export ===\n');

  const engine = new ExportTemplateEngine();

  // Create template
  const template = engine.createTemplate({
    name: 'Product Export',
    description: 'Batch export of product catalog',
    format: 'csv',
    fields: [
      { source: 'id', target: 'product_id' },
      { source: 'name', target: 'product_name', transforms: ['uppercase'] },
      { source: 'price', target: 'price_usd', transforms: [{ name: 'round', args: [2] }] },
      { source: 'stock', target: 'inventory_count' },
      {
        source: 'category',
        target: 'category',
        transforms: ['lowercase']
      }
    ]
  });

  // Sample batch data
  const products = [
    { id: 'P001', name: 'Laptop', price: 999.99, stock: 15, category: 'Electronics' },
    { id: 'P002', name: 'Mouse', price: 29.99, stock: 150, category: 'Accessories' },
    { id: 'P003', name: 'Keyboard', price: 79.99, stock: 75, category: 'Accessories' },
    { id: 'P004', name: 'Monitor', price: 299.99, stock: 30, category: 'Electronics' }
  ];

  // Export batch
  const result = engine.exportWithTemplate(template.id, products);

  console.log('Batch export metadata:');
  console.log(`Records exported: ${result.metadata.recordsExported}`);
  console.log(`Fields included: ${result.metadata.fieldsIncluded}`);

  // Format as CSV
  const csvData = engine.formatExport(result.data, 'csv');
  console.log('\nCSV Output:');
  console.log(csvData);

  // Also export as JSON
  console.log('\nJSON Output:');
  console.log(JSON.stringify(result.data, null, 2));
}

/**
 * Example 5: Nested Data Export
 * Export data with nested object and array paths
 */
function example5_NestedDataExport() {
  console.log('\n=== Example 5: Nested Data Export ===\n');

  const engine = new ExportTemplateEngine();

  // Create template with nested paths
  const template = engine.createTemplate({
    name: 'Detailed User Export',
    description: 'Export user with nested profile and contact info',
    format: 'json',
    fields: [
      { source: 'id', target: 'id' },
      { source: 'user.profile.firstName', target: 'first_name' },
      { source: 'user.profile.lastName', target: 'last_name' },
      { source: 'user.contact.email', target: 'email' },
      { source: 'user.contact.phone', target: 'phone' },
      { source: 'user.address.city', target: 'city' },
      { source: 'user.address.country', target: 'country' },
      {
        source: 'user.tags',
        target: 'tags',
        transforms: [{ name: 'join', args: ['; '] }]
      }
    ]
  });

  // Sample nested data
  const userData = {
    id: 'user-001',
    user: {
      profile: {
        firstName: 'John',
        lastName: 'Doe'
      },
      contact: {
        email: 'john@example.com',
        phone: '+1-555-1234'
      },
      address: {
        city: 'New York',
        country: 'USA'
      },
      tags: ['vip', 'verified', 'early-adopter']
    }
  };

  const result = engine.exportWithTemplate(template.id, userData);
  console.log('Nested data export:');
  console.log(JSON.stringify(result.data, null, 2));
}

/**
 * Example 6: Global Transforms
 * Apply transforms to all fields
 */
function example6_GlobalTransforms() {
  console.log('\n=== Example 6: Global Transforms ===\n');

  const engine = new ExportTemplateEngine();

  // Create template with global transforms
  const template = engine.createTemplate({
    name: 'Sanitized Export',
    description: 'Export with global trimming and uppercase for all fields',
    format: 'json',
    globalTransforms: ['trim'],
    fields: [
      { source: 'id', target: 'id' },
      { source: 'name', target: 'name' },
      { source: 'city', target: 'city' },
      { source: 'country', target: 'country' }
    ]
  });

  const data = {
    id: '  123  ',
    name: '  john doe  ',
    city: '  new york  ',
    country: '  united states  '
  };

  const result = engine.exportWithTemplate(template.id, data);
  console.log('Global transforms applied (trim all fields):');
  console.log(JSON.stringify(result.data, null, 2));
}

/**
 * Example 7: Custom Transforms
 * Register and use custom transformation functions
 */
function example7_CustomTransforms() {
  console.log('\n=== Example 7: Custom Transforms ===\n');

  const engine = new ExportTemplateEngine();

  // Register custom transforms
  engine.registerTransform('reverseString', (val) => {
    if (typeof val === 'string') {
      return val.split('').reverse().join('');
    }
    return val;
  });

  engine.registerTransform('initials', (val) => {
    if (typeof val === 'string') {
      return val.split(' ')
        .map(word => word[0])
        .join('.')
        .toUpperCase();
    }
    return val;
  });

  engine.registerTransform('phoneFormat', (val) => {
    if (typeof val === 'string') {
      const digits = val.replace(/\D/g, '');
      if (digits.length === 10) {
        return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
      }
    }
    return val;
  });

  // Create template using custom transforms
  const template = engine.createTemplate({
    name: 'Formatted Export',
    description: 'Export with custom formatting transforms',
    format: 'json',
    fields: [
      { source: 'id', target: 'id' },
      {
        source: 'fullName',
        target: 'full_name',
        transforms: ['uppercase']
      },
      {
        source: 'fullName',
        target: 'initials',
        transforms: ['initials']
      },
      {
        source: 'phone',
        target: 'phone_formatted',
        transforms: ['phoneFormat']
      }
    ]
  });

  const data = {
    id: 'U001',
    fullName: 'John Michael Smith',
    phone: '5551234567'
  };

  const result = engine.exportWithTemplate(template.id, data);
  console.log('Custom transforms applied:');
  console.log(JSON.stringify(result.data, null, 2));
}

/**
 * Example 8: XML and CSV Export Formats
 * Export data in multiple formats
 */
function example8_MultipleFormats() {
  console.log('\n=== Example 8: Multiple Export Formats ===\n');

  const engine = new ExportTemplateEngine();

  // Create simple template
  const template = engine.createTemplate({
    name: 'Multi-Format Export',
    description: 'Export same data in different formats',
    format: 'json',
    fields: [
      { source: 'id', target: 'id' },
      { source: 'name', target: 'name' },
      { source: 'email', target: 'email' }
    ]
  });

  const data = [
    { id: 1, name: 'John Doe', email: 'john@example.com' },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com' }
  ];

  const result = engine.exportWithTemplate(template.id, data);

  // Export as JSON
  console.log('JSON Format:');
  const json = engine.formatExport(result.data, 'json');
  console.log(json);

  // Export as CSV
  console.log('\nCSV Format:');
  const csv = engine.formatExport(result.data, 'csv');
  console.log(csv);

  // Export as XML
  console.log('\nXML Format:');
  const xml = engine.formatExport(result.data, 'xml');
  console.log(xml);
}

/**
 * Example 9: Template Validation and Testing
 * Validate templates before use
 */
function example9_ValidationAndTesting() {
  console.log('\n=== Example 9: Template Validation and Testing ===\n');

  const engine = new ExportTemplateEngine();

  // Create template
  const template = engine.createTemplate({
    name: 'Test Template',
    description: 'Template for validation testing',
    format: 'json',
    fields: [
      { source: 'id', target: 'id' },
      { source: 'name', target: 'name', transforms: ['uppercase'] },
      { source: 'email', target: 'email' }
    ]
  });

  // Validate template
  console.log('Validating template...');
  const validation = engine.validateTemplate(template.id);
  console.log(`Valid: ${validation.valid}`);
  console.log(`Errors: ${validation.errors.length}`);
  console.log(`Warnings: ${validation.warnings.length}`);

  // Test template with sample data
  console.log('\nTesting template with sample data...');
  const sampleData = {
    id: 1,
    name: 'john doe',
    email: 'john@example.com'
  };

  const testResult = engine.testTemplate(template.id, sampleData);
  console.log('Test result:');
  console.log(JSON.stringify(testResult, null, 2));
}

/**
 * Example 10: Template Management
 * Create, update, clone, and manage templates
 */
function example10_TemplateManagement() {
  console.log('\n=== Example 10: Template Management ===\n');

  const engine = new ExportTemplateEngine();

  // Create initial template
  const baseTemplate = engine.createTemplate({
    name: 'Base Export Template',
    description: 'Base template for user exports',
    format: 'json',
    fields: [
      { source: 'id', target: 'id' },
      { source: 'name', target: 'name' }
    ]
  });

  console.log(`Created: ${baseTemplate.name}`);

  // Update template
  const updated = engine.updateTemplate(baseTemplate.id, {
    description: 'Updated base template',
    fields: [
      { source: 'id', target: 'id' },
      { source: 'name', target: 'name' },
      { source: 'email', target: 'email' }
    ]
  });

  console.log(`Updated: ${updated.name}, version: ${updated.version}`);

  // Clone template
  const cloned = engine.cloneTemplate(baseTemplate.id, 'CSV Export Template');
  console.log(`Cloned: ${cloned.name}`);

  // Update cloned template
  engine.updateTemplate(cloned.id, { format: 'csv' });

  // List all templates
  console.log('\nAll templates:');
  const templates = engine.listTemplates();
  templates.forEach(t => {
    console.log(`- ${t.name} (${t.format}, v${t.version})`);
  });

  // Get statistics
  console.log('\nStatistics:');
  const stats = engine.getStatistics();
  console.log(`Total templates: ${stats.totalTemplates}`);
  console.log(`Registered transforms: ${stats.registeredTransforms}`);
}

/**
 * Run all examples
 */
function runAllExamples() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║     Export Templates - Feature Implementation Examples     ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');

  try {
    example1_BasicUserExport();
    example2_DataTransformations();
    example3_ConditionalExports();
    example4_BatchExport();
    example5_NestedDataExport();
    example6_GlobalTransforms();
    example7_CustomTransforms();
    example8_MultipleFormats();
    example9_ValidationAndTesting();
    example10_TemplateManagement();

    console.log('\n╔═══════════════════════════════════════════════════════════╗');
    console.log('║                  All Examples Completed!                   ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');
  } catch (error) {
    console.error('Error running examples:', error);
  }
}

// Export for use as module or run directly
if (require.main === module) {
  runAllExamples();
}

module.exports = {
  example1_BasicUserExport,
  example2_DataTransformations,
  example3_ConditionalExports,
  example4_BatchExport,
  example5_NestedDataExport,
  example6_GlobalTransforms,
  example7_CustomTransforms,
  example8_MultipleFormats,
  example9_ValidationAndTesting,
  example10_TemplateManagement,
  runAllExamples
};
