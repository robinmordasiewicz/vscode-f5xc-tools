/**
 * Description normalizer for F5 XC resource types.
 *
 * This module provides functions to normalize descriptions from OpenAPI specs,
 * replacing legacy Volterra terminology with current F5 Distributed Cloud branding.
 *
 * Note: This only affects user-facing descriptions, not API field names.
 */

/**
 * Terminology replacement rules.
 * Each rule maps a pattern to its replacement.
 * Patterns are applied in order, so more specific patterns should come first.
 */
const TERMINOLOGY_REPLACEMENTS: Array<{ pattern: RegExp; replacement: string }> = [
  // URL patterns - these should NOT be changed as they are actual URLs
  // We explicitly skip console.ves.volterra.io URLs

  // Product name replacements (case-insensitive)
  { pattern: /\bVolterra's\b/gi, replacement: "F5 XC's" },
  { pattern: /\bVolterra\b/g, replacement: 'F5 XC' },
  { pattern: /\bvolterra\b/g, replacement: 'F5 XC' },

  // Service references
  { pattern: /\bvolterra service\b/gi, replacement: 'F5 XC service' },
  { pattern: /\bvolterra edge cloud\b/gi, replacement: 'F5 XC edge cloud' },
  { pattern: /\bvolterra software appliance\b/gi, replacement: 'F5 XC software appliance' },
  { pattern: /\bvolterra site\b/gi, replacement: 'F5 XC site' },

  // VoltConsole references
  { pattern: /\bVoltConsole\b/g, replacement: 'F5 XC Console' },

  // Regional Edge references
  { pattern: /\bregional sites from volterra\b/gi, replacement: 'F5 XC Regional Edge sites' },
];

/**
 * Patterns that should NOT be modified (API field names, URLs, etc.)
 */
const PRESERVE_PATTERNS: RegExp[] = [
  // Actual console URLs
  /console\.ves\.volterra\.io/g,
  // API field names (these appear in descriptions as references)
  /volterra_software_version/g,
  /dns_volterra_managed/g,
  /volterra_trusted_ca/g,
];

/**
 * Normalize a description by replacing legacy terminology with current branding.
 *
 * @param description - The original description from OpenAPI spec
 * @returns The normalized description with updated terminology
 */
export function normalizeDescription(description: string): string {
  if (!description) {
    return description;
  }

  // First, extract and preserve patterns that should not be modified
  const preservedTokens: Map<string, string> = new Map();
  let result = description;
  let tokenIndex = 0;

  for (const pattern of PRESERVE_PATTERNS) {
    result = result.replace(pattern, (match) => {
      const token = `__PRESERVED_${tokenIndex++}__`;
      preservedTokens.set(token, match);
      return token;
    });
  }

  // Apply terminology replacements
  for (const { pattern, replacement } of TERMINOLOGY_REPLACEMENTS) {
    result = result.replace(pattern, replacement);
  }

  // Restore preserved patterns
  for (const [token, original] of preservedTokens) {
    result = result.replace(token, original);
  }

  return result;
}

/**
 * Get a summary of terminology changes that would be applied to a description.
 * Useful for debugging and verification.
 *
 * @param description - The original description
 * @returns Object with original, normalized, and list of changes
 */
export function analyzeDescription(description: string): {
  original: string;
  normalized: string;
  changes: Array<{ from: string; to: string }>;
} {
  const normalized = normalizeDescription(description);
  const changes: Array<{ from: string; to: string }> = [];

  // Simple diff to identify changes
  if (description !== normalized) {
    for (const { pattern, replacement } of TERMINOLOGY_REPLACEMENTS) {
      const matches = description.match(pattern);
      if (matches) {
        for (const match of matches) {
          // Only add if this change is actually in the result
          if (description.includes(match) && !normalized.includes(match)) {
            changes.push({ from: match, to: replacement });
          }
        }
      }
    }
  }

  return { original: description, normalized, changes };
}
