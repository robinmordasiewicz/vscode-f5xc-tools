/**
 * Build-time script to generate documentation URLs from OpenAPI spec files.
 *
 * This script reads all OpenAPI spec files from docs/specifications/api/
 * and extracts documentation URLs to create a TypeScript mapping file.
 *
 * Usage: npx ts-node scripts/generate-doc-urls.ts
 */

import * as fs from 'fs';
import * as path from 'path';

interface SpecInfo {
  schemaId: string;
  resourceType: string;
  docUrl: string;
}

/**
 * OpenAPI spec structure (minimal interface for what we need)
 */
interface OpenAPISpec {
  externalDocs?: {
    url?: string;
  };
  paths?: Record<string, Record<string, { externalDocs?: { url?: string } }>>;
}

const SPEC_DIR = path.join(__dirname, '..', 'docs', 'specifications', 'api');
const OUTPUT_FILE = path.join(__dirname, '..', 'src', 'generated', 'documentationUrls.ts');

/**
 * Extract schema identifier from spec filename.
 * Example: "docs-cloud-f5-com.0073.public.ves.io.schema.views.http_loadbalancer.ves-swagger.json"
 * Returns: "ves.io.schema.views.http_loadbalancer"
 */
function extractSchemaId(filename: string): string | null {
  // Pattern: docs-cloud-f5-com.NNNN.public.<schema-id>.ves-swagger.json
  const match = filename.match(/^docs-cloud-f5-com\.\d+\.public\.(.+)\.ves-swagger\.json$/);
  return match && match[1] ? match[1] : null;
}

/**
 * Derive the resource type key from schema ID.
 * Example: "ves.io.schema.views.http_loadbalancer" -> "http_loadbalancers"
 * Example: "ves.io.schema.app_firewall" -> "app_firewalls"
 */
function deriveResourceType(schemaId: string): string | null {
  // Extract the last part after 'schema.' or 'schema.views.'
  const parts = schemaId.split('.');
  const schemaIndex = parts.indexOf('schema');
  if (schemaIndex === -1 || schemaIndex >= parts.length - 1) {
    return null;
  }

  // Get everything after 'schema'
  const afterSchema = parts.slice(schemaIndex + 1);

  // If it starts with 'views.', take the next part
  if (afterSchema[0] === 'views' && afterSchema.length > 1) {
    const resourceName = afterSchema[1];
    // Convert to plural form used in RESOURCE_TYPES (e.g., http_loadbalancer -> http_loadbalancers)
    return resourceName + 's';
  }

  // Otherwise take the first part after schema
  const resourceName = afterSchema[0];
  return resourceName + 's';
}

/**
 * Extract the first externalDocs URL from a spec file.
 */
function extractDocUrl(specPath: string): string | null {
  try {
    const content = fs.readFileSync(specPath, 'utf-8');
    const spec = JSON.parse(content) as OpenAPISpec;

    // Check for top-level externalDocs first
    if (spec.externalDocs?.url) {
      return spec.externalDocs.url;
    }

    // Otherwise, find the first externalDocs URL in paths
    if (spec.paths) {
      for (const pathObj of Object.values(spec.paths)) {
        for (const method of Object.values(pathObj)) {
          if (method.externalDocs?.url) {
            return method.externalDocs.url;
          }
        }
      }
    }

    return null;
  } catch (e) {
    console.error(`Error reading spec file ${specPath}:`, e);
    return null;
  }
}

/**
 * Transform an operation-specific URL to a general documentation URL.
 * Example: "https://docs.cloud.f5.com/docs-v2/platform/reference/api-ref/ves-io-schema-views-http_loadbalancer-api-create"
 * Returns: "https://docs.cloud.f5.com/docs-v2/api/views-http-loadbalancer"
 */
function transformToGeneralDocUrl(operationUrl: string, schemaId: string): string {
  // Extract the schema path from schema ID
  // ves.io.schema.views.http_loadbalancer -> views.http_loadbalancer
  // ves.io.schema.app_firewall -> app_firewall
  const parts = schemaId.split('.');
  const schemaIndex = parts.indexOf('schema');
  if (schemaIndex === -1) {
    return operationUrl;
  }

  const afterSchema = parts.slice(schemaIndex + 1);
  // Convert dots to hyphens and underscores to hyphens
  const docPath = afterSchema.join('-').replace(/_/g, '-');

  return `https://docs.cloud.f5.com/docs-v2/api/${docPath}`;
}

/**
 * Main function to generate the documentation URLs mapping.
 */
function main(): void {
  console.log('Generating documentation URLs from OpenAPI specs...');

  if (!fs.existsSync(SPEC_DIR)) {
    console.error(`Spec directory not found: ${SPEC_DIR}`);
    process.exit(1);
  }

  // Sort spec files for deterministic processing order
  const specFiles = fs
    .readdirSync(SPEC_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort();
  console.log(`Found ${specFiles.length} spec files`);

  const urlMap: Record<string, string> = {};
  const processed: SpecInfo[] = [];

  for (const filename of specFiles) {
    const schemaId = extractSchemaId(filename);
    if (!schemaId) {
      continue;
    }

    const resourceType = deriveResourceType(schemaId);
    if (!resourceType) {
      continue;
    }

    const specPath = path.join(SPEC_DIR, filename);
    const operationUrl = extractDocUrl(specPath);
    if (!operationUrl) {
      continue;
    }

    const docUrl = transformToGeneralDocUrl(operationUrl, schemaId);

    // Only add if we don't already have this resource type
    if (!urlMap[resourceType]) {
      urlMap[resourceType] = docUrl;
      processed.push({ schemaId, resourceType, docUrl });
    }
  }

  console.log(`Processed ${processed.length} resource types`);

  // Sort urlMap keys for deterministic output
  const sortedUrlMap: Record<string, string> = {};
  const sortedKeys = Object.keys(urlMap).sort();
  for (const key of sortedKeys) {
    const value = urlMap[key];
    if (value !== undefined) {
      sortedUrlMap[key] = value;
    }
  }

  // Generate TypeScript output
  const output = `/**
 * Auto-generated documentation URLs from OpenAPI spec files.
 * DO NOT EDIT - This file is generated by scripts/generate-doc-urls.ts
 *
 * Total documentation URLs: ${sortedKeys.length}
 */

/**
 * Mapping of resource type keys to their documentation URLs.
 * Resource types use the plural form (e.g., 'http_loadbalancers').
 */
export const DOCUMENTATION_URLS: Record<string, string> = ${JSON.stringify(sortedUrlMap, null, 2)};

/**
 * Get the documentation URL for a resource type.
 * Falls back to the base API docs URL if the resource type is not found.
 *
 * @param resourceType - The resource type key (e.g., 'http_loadbalancers')
 * @returns The documentation URL
 */
export function getDocumentationUrl(resourceType: string): string {
  const baseUrl = 'https://docs.cloud.f5.com/docs-v2/api';
  return DOCUMENTATION_URLS[resourceType] || baseUrl;
}
`;

  // Ensure output directory exists
  const outputDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_FILE, output, 'utf-8');
  console.log(`Generated: ${OUTPUT_FILE}`);

  // Print summary of key mappings
  const keyTypes = [
    'http_loadbalancers',
    'tcp_loadbalancers',
    'origin_pools',
    'app_firewalls',
    'service_policys',
    'healthchecks',
  ];

  console.log('\nKey resource type mappings:');
  for (const type of keyTypes) {
    if (urlMap[type]) {
      console.log(`  ${type}: ${urlMap[type]}`);
    }
  }
}

main();
