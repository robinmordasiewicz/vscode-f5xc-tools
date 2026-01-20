// Copyright (c) 2026 Robin Mordasiewicz. MIT License.

/**
 * Inline completion provider for F5 XC JSON resources.
 * Provides Copilot-style ghost text suggestions for property values.
 */

import * as vscode from 'vscode';
import { CompletionHelper } from '../utils/completionHelper';
import { getSchemaRegistry } from '../schema/schemaRegistry';
import { SchemaProperty } from '../schema/schemaGenerator';
import { getLogger } from '../utils/logger';

const logger = getLogger();

/**
 * Provides inline ghost text completions for F5 XC JSON files.
 * Shows recommended/default values as greyed-out text after property colons.
 */
export class F5XCInlineCompletionProvider implements vscode.InlineCompletionItemProvider {
  /**
   * Provide inline completion items (ghost text) for the current position
   */
  provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    _context: vscode.InlineCompletionContext,
    _token: vscode.CancellationToken,
  ): vscode.ProviderResult<vscode.InlineCompletionItem[] | vscode.InlineCompletionList> {
    // Check if this is an F5 XC JSON file
    if (!CompletionHelper.isF5XCJsonFile(document)) {
      return undefined;
    }

    // Get current line text
    const line = document.lineAt(position.line);
    const lineText = line.text;
    const cursorOffset = position.character;

    // Check if cursor is after property colon
    const textBeforeCursor = lineText.substring(0, cursorOffset);
    if (!CompletionHelper.isAfterPropertyColon(textBeforeCursor)) {
      return undefined;
    }

    // Check if there's already text after colon (user is typing)
    const textAfterColon = textBeforeCursor.substring(textBeforeCursor.lastIndexOf(':') + 1).trim();
    if (textAfterColon.length > 0) {
      // User already started typing, don't show ghost text
      return undefined;
    }

    // Get resource type and schema
    const resourceType = CompletionHelper.detectResourceType(document);
    if (!resourceType) {
      return undefined;
    }

    const registry = getSchemaRegistry();
    const schema = registry.getOrGenerateSchema(resourceType);
    if (!schema) {
      return undefined;
    }

    // Get JSON context
    const jsonContext = CompletionHelper.getCurrentJsonContext(document, position);

    // We need to know which property we're completing
    if (!jsonContext.afterColon || !jsonContext.propertyName) {
      return undefined;
    }

    logger.debug(
      `Inline completion for property: ${jsonContext.propertyName} at path: ${jsonContext.path.join('.')}`,
    );

    // Find the schema for this property
    const propertyPath = [...jsonContext.path, jsonContext.propertyName];
    const propertySchema = CompletionHelper.navigateSchemaPath(schema, propertyPath);

    if (!propertySchema) {
      return undefined;
    }

    // Get recommended or default value
    const recommendedValue = this.getRecommendedValue(propertySchema);
    if (recommendedValue === undefined) {
      return undefined;
    }

    // Format value for JSON
    const formattedValue = this.formatValueForInlineCompletion(
      recommendedValue,
      propertySchema.type,
    );

    if (!formattedValue) {
      return undefined;
    }

    // Create inline completion item
    const item = new vscode.InlineCompletionItem(formattedValue);
    item.range = new vscode.Range(position, position);

    logger.debug(`Providing inline completion: ${formattedValue}`);

    return [item];
  }

  /**
   * Get recommended value from schema
   */
  private getRecommendedValue(schema: SchemaProperty): unknown {
    // Priority: recommended value > default value
    if (schema['x-f5xc-recommended-value'] !== undefined) {
      return schema['x-f5xc-recommended-value'];
    }

    if (schema.default !== undefined) {
      return schema.default;
    }

    // For boolean without default, suggest common default
    if (schema.type === 'boolean') {
      return false;
    }

    return undefined;
  }

  /**
   * Format value for inline completion (ghost text)
   */
  private formatValueForInlineCompletion(
    value: unknown,
    type?: string | string[],
  ): string | undefined {
    if (value === null) {
      return 'null';
    }

    if (value === undefined) {
      return undefined;
    }

    const primaryType = Array.isArray(type) ? type[0] : type;

    switch (primaryType) {
      case 'string': {
        // For single-line strings, show with quotes
        const stringValue = String(value);
        if (stringValue.includes('\n')) {
          // Multi-line string - don't show inline
          return undefined;
        }
        return JSON.stringify(stringValue);
      }

      case 'number':
      case 'integer':
        return String(value);

      case 'boolean':
        return String(value);

      case 'array':
        // For simple arrays, show inline
        if (Array.isArray(value) && value.length === 0) {
          return '[]';
        }
        // For non-empty arrays, show compact representation if short
        if (Array.isArray(value)) {
          const compact = JSON.stringify(value);
          if (compact.length <= 50) {
            return compact;
          }
        }
        return undefined;

      case 'object':
        // For empty objects, show inline
        if (typeof value === 'object' && Object.keys(value).length === 0) {
          return '{}';
        }
        // For non-empty objects, show compact if very short
        if (typeof value === 'object') {
          const compact = JSON.stringify(value);
          if (compact.length <= 30) {
            return compact;
          }
        }
        return undefined;

      default:
        // Try JSON serialization for unknown types
        try {
          const serialized = JSON.stringify(value);
          if (serialized.length <= 50) {
            return serialized;
          }
        } catch {
          return undefined;
        }
        return undefined;
    }
  }
}
