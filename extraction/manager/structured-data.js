/**
 * Basset Hound Browser - Structured Data Extractor
 * Extracts JSON-LD, Microdata, and RDFa structured data from HTML.
 * Pure function delegated from ExtractionManager; receives the manager instance as `self`
 * for the specialized parsers (jsonLdParser, microdataParser, rdfaParser).
 *
 * @module extraction/manager/structured-data
 */

/**
 * Extract all structured data from HTML
 * Includes JSON-LD, Microdata, and RDFa
 * @param {string} html - HTML content
 * @param {ExtractionManager} self - Manager instance providing structured-data parsers
 * @returns {Object} Extracted structured data
 */
function extractStructuredData(html, self) {
  const result = {
    success: true,
    data: {
      jsonLd: null,
      microdata: null,
      rdfa: null
    },
    types: [],
    count: 0,
    errors: [],
    warnings: []
  };

  self.stats.totalExtractions++;
  self.stats.structuredDataExtractions++;

  if (!html || typeof html !== 'string') {
    result.success = false;
    result.errors.push('Invalid HTML input');
    return result;
  }

  try {
    // Extract JSON-LD
    const jsonLdResult = self.jsonLdParser.parse(html);
    result.data.jsonLd = {
      data: jsonLdResult.data,
      types: jsonLdResult.types,
      count: jsonLdResult.count
    };
    result.count += jsonLdResult.count;
    result.types.push(...jsonLdResult.types);
    result.errors.push(...jsonLdResult.errors);
    result.warnings.push(...jsonLdResult.warnings);

    // Extract Microdata
    const microdataResult = self.microdataParser.parse(html);
    result.data.microdata = {
      data: microdataResult.data,
      types: microdataResult.types,
      count: microdataResult.count
    };
    result.count += microdataResult.count;
    for (const type of microdataResult.types) {
      if (!result.types.includes(type)) {
        result.types.push(type);
      }
    }
    result.errors.push(...microdataResult.errors);
    result.warnings.push(...microdataResult.warnings);

    // Extract RDFa
    const rdfaResult = self.rdfaParser.parse(html);
    result.data.rdfa = {
      data: rdfaResult.data,
      prefixes: rdfaResult.prefixes,
      count: rdfaResult.count
    };
    result.count += rdfaResult.count;
    result.errors.push(...rdfaResult.errors);
    result.warnings.push(...rdfaResult.warnings);

    // Deduplicate types
    result.types = [...new Set(result.types)];

    // Summary
    result.summary = {
      hasJsonLd: jsonLdResult.count > 0,
      hasMicrodata: microdataResult.count > 0,
      hasRdfa: rdfaResult.count > 0,
      jsonLdCount: jsonLdResult.count,
      microdataCount: microdataResult.count,
      rdfaCount: rdfaResult.count,
      totalEntities: result.count,
      uniqueTypes: result.types.length
    };

  } catch (error) {
    result.success = false;
    result.errors.push(`Extraction error: ${error.message}`);
  }

  return result;
}

module.exports = { extractStructuredData };
