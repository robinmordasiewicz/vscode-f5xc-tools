// Copyright (c) 2026 Robin Mordasiewicz. MIT License.

/**
 * Completion provider for F5 XC JSON resources.
 * Provides multi-line template completions with default/recommended values.
 */

import * as vscode from 'vscode';
import { CompletionHelper } from '../utils/completionHelper';
import { getSchemaRegistry } from '../schema/schemaRegistry';
import { SchemaProperty } from '../schema/schemaGenerator';
import { getLogger } from '../utils/logger';

const logger = getLogger();

/**
 * Provides intelligent completions for F5 XC JSON files.
 * Shows full object templates with tab stops for easy navigation.
 */
export class F5XCCompletionProvider implements vscode.CompletionItemProvider {
  /**
   * Provide completion items for the current position
   */
  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken,
    _context: vscode.CompletionContext,
  ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
    logger.debug('Completion provider triggered', {
      uri: document.uri.toString(),
      language: document.languageId,
      position: `${position.line}:${position.character}`,
    });

    // Check if this is an F5 XC JSON file
    const isF5XCFile = CompletionHelper.isF5XCJsonFile(document);
    if (!isF5XCFile) {
      return undefined;
    }

    // Get resource type and schema
    const resourceType = CompletionHelper.detectResourceType(document);
    if (!resourceType) {
      logger.debug('No resource type detected for completion');
      return undefined;
    }

    const registry = getSchemaRegistry();
    const schema = registry.getOrGenerateSchema(resourceType);
    if (!schema) {
      return undefined;
    }

    // Get current JSON context
    const jsonContext = CompletionHelper.getCurrentJsonContext(document, position);

    logger.debug(`Completion triggered at path: ${jsonContext.path.join('.')}`);

    // Generate completions based on context
    const completions: vscode.CompletionItem[] = [];

    // Case 1: Empty file or at root level
    if (
      jsonContext.path.length === 0 ||
      (jsonContext.path.length === 1 && jsonContext.path[0] === '')
    ) {
      completions.push(...this.generateRootCompletions(schema, jsonContext.indentString));
    }
    // Case 2: Inside an object, waiting for property
    else if (jsonContext.inObject && !jsonContext.afterColon) {
      const currentSchema = CompletionHelper.navigateSchemaPath(schema, jsonContext.path);
      if (currentSchema) {
        completions.push(...this.generatePropertyCompletions(currentSchema, jsonContext));
      }
    }
    // Case 3: After property colon, waiting for value
    else if (jsonContext.afterColon && jsonContext.propertyName) {
      const propertyPath = [...jsonContext.path, jsonContext.propertyName];
      const propertySchema = CompletionHelper.navigateSchemaPath(schema, propertyPath);
      if (propertySchema) {
        completions.push(...this.generateValueCompletions(propertySchema, jsonContext));
      }
    }

    return completions;
  }

  /**
   * Generate completions for root-level structure (metadata, spec)
   */
  private generateRootCompletions(
    schema: SchemaProperty,
    indentString: string,
  ): vscode.CompletionItem[] {
    const completions: vscode.CompletionItem[] = [];

    // Full resource template
    const fullTemplate = this.createFullResourceTemplate(schema, indentString);
    const fullItem = new vscode.CompletionItem(
      'Full resource template',
      vscode.CompletionItemKind.Snippet,
    );
    fullItem.insertText = new vscode.SnippetString(fullTemplate);
    fullItem.documentation = new vscode.MarkdownString(
      'Complete F5 XC resource structure with metadata and spec',
    );
    fullItem.sortText = '0'; // Show first
    fullItem.detail = 'Complete resource template';
    completions.push(fullItem);

    // Individual section templates
    if (schema.properties) {
      for (const [propName, propSchema] of Object.entries(schema.properties)) {
        const template = this.createSectionTemplate(propName, propSchema, indentString);
        const item = new vscode.CompletionItem(
          `${propName} section`,
          vscode.CompletionItemKind.Snippet,
        );
        item.insertText = new vscode.SnippetString(template);
        item.documentation = new vscode.MarkdownString(
          propSchema.description || `${propName} section template`,
        );
        item.sortText = `1-${propName}`;
        item.detail = `${propName} template`;
        completions.push(item);
      }
    }

    return completions;
  }

  /**
   * Generate completions for properties within an object
   */
  private generatePropertyCompletions(
    schema: SchemaProperty,
    context: { indentString: string },
  ): vscode.CompletionItem[] {
    const completions: vscode.CompletionItem[] = [];

    if (!schema.properties) {
      return completions;
    }

    const required = schema.required || [];

    for (const [propName, propSchema] of Object.entries(schema.properties)) {
      const isRequired = required.includes(propName);
      const hasRecommended = propSchema['x-f5xc-recommended-value'] !== undefined;

      // Create property completion with value template
      const item = new vscode.CompletionItem(propName, vscode.CompletionItemKind.Property);

      // Generate the insertion text based on property type
      const insertText = this.createPropertyInsertText(propName, propSchema, context.indentString);
      item.insertText = new vscode.SnippetString(insertText);

      // Add documentation
      const docs: string[] = [];
      if (propSchema.description) {
        docs.push(propSchema.description);
      }
      if (isRequired) {
        docs.push('**Required**');
      }
      if (hasRecommended) {
        docs.push(`Recommended: \`${JSON.stringify(propSchema['x-f5xc-recommended-value'])}\``);
      }
      if (propSchema['x-f5xc-server-default']) {
        docs.push('*Server provides default*');
      }

      item.documentation = new vscode.MarkdownString(docs.join('\n\n'));

      // Sort order: required first, then recommended, then alphabetical
      if (isRequired) {
        item.sortText = `0-${propName}`;
      } else if (hasRecommended) {
        item.sortText = `1-${propName}`;
      } else {
        item.sortText = `2-${propName}`;
      }

      item.detail = this.getPropertyDetail(propSchema, isRequired);

      completions.push(item);
    }

    return completions;
  }

  /**
   * Generate completions for values (after colon)
   */
  private generateValueCompletions(
    schema: SchemaProperty,
    context: { indentString: string },
  ): vscode.CompletionItem[] {
    const completions: vscode.CompletionItem[] = [];

    // For object types, provide template completion
    if (schema.type === 'object' && schema.properties) {
      const template = CompletionHelper.generateObjectTemplate(
        schema,
        context.indentString,
        true, // include optional with recommended values
      );

      const item = new vscode.CompletionItem('Object template', vscode.CompletionItemKind.Snippet);
      item.insertText = new vscode.SnippetString(template);
      item.documentation = new vscode.MarkdownString(
        'Complete object structure with default values',
      );
      item.sortText = '0';
      completions.push(item);

      // Minimal template (required only)
      const minimalTemplate = CompletionHelper.generateObjectTemplate(
        schema,
        context.indentString,
        false, // required only
      );

      if (minimalTemplate !== template) {
        const minimalItem = new vscode.CompletionItem(
          'Minimal template',
          vscode.CompletionItemKind.Snippet,
        );
        minimalItem.insertText = new vscode.SnippetString(minimalTemplate);
        minimalItem.documentation = new vscode.MarkdownString(
          'Minimal object with required fields only',
        );
        minimalItem.sortText = '1';
        completions.push(minimalItem);
      }
    }

    // For arrays, provide array template
    if (schema.type === 'array' && schema.items) {
      const item = new vscode.CompletionItem('Array', vscode.CompletionItemKind.Value);
      item.insertText = new vscode.SnippetString('[\n  $0\n]');
      item.documentation = new vscode.MarkdownString('Empty array');
      completions.push(item);
    }

    // For enums, provide enum values
    if (schema.enum) {
      for (const enumValue of schema.enum) {
        const item = new vscode.CompletionItem(
          String(enumValue),
          vscode.CompletionItemKind.EnumMember,
        );
        item.insertText = JSON.stringify(enumValue);
        completions.push(item);
      }
    }

    return completions;
  }

  /**
   * Create full resource template
   */
  private createFullResourceTemplate(schema: SchemaProperty, baseIndent: string): string {
    const indent1 = baseIndent + '  ';
    const lines: string[] = [];

    lines.push('{');

    let tabStop = 1;

    // metadata section
    if (schema.properties?.metadata) {
      lines.push(`${indent1}"metadata": {`);
      const indent2 = indent1 + '  ';

      // Required: name
      lines.push(`${indent2}"name": "\${${tabStop++}:resource-name}",`);

      // Optional but common: namespace
      lines.push(`${indent2}"namespace": "\${${tabStop++}:default}",`);

      // Optional: labels, annotations
      lines.push(`${indent2}"labels": {},`);
      lines.push(`${indent2}"annotations": {}`);

      lines.push(`${indent1}},`);
    }

    // spec section
    if (schema.properties?.spec) {
      const specSchema = schema.properties.spec;
      lines.push(`${indent1}"spec": {`);

      if (specSchema.properties) {
        const specProps = Object.entries(specSchema.properties);
        const required = specSchema.required || [];

        // Add required properties
        const requiredProps = specProps.filter(([name]) => required.includes(name));
        for (let i = 0; i < requiredProps.length; i++) {
          const entry = requiredProps[i];
          if (entry) {
            const [propName, propSchema] = entry;
            const value = this.getDefaultValueSnippet(propSchema, tabStop++);
            const comma = i < requiredProps.length - 1 ? ',' : '';
            lines.push(`${indent1}  "${propName}": ${value}${comma}`);
          }
        }

        // If no required props, add placeholder
        if (requiredProps.length === 0) {
          lines.push(`${indent1}  $0`);
        }
      }

      lines.push(`${indent1}}`);
    }

    lines.push('}');

    return lines.join('\n');
  }

  /**
   * Create section template (metadata or spec)
   */
  private createSectionTemplate(
    sectionName: string,
    schema: SchemaProperty,
    baseIndent: string,
  ): string {
    const template = CompletionHelper.generateObjectTemplate(schema, baseIndent, true);
    return `"${sectionName}": ${template}`;
  }

  /**
   * Create property insertion text
   */
  private createPropertyInsertText(
    propName: string,
    propSchema: SchemaProperty,
    indentString: string,
  ): string {
    const recommendedValue = propSchema['x-f5xc-recommended-value'];
    const defaultValue = propSchema.default;
    const value = recommendedValue ?? defaultValue;

    // For complex types, use templates
    if (propSchema.type === 'object' && propSchema.properties) {
      const objTemplate = CompletionHelper.generateObjectTemplate(propSchema, indentString, true);
      return `"${propName}": ${objTemplate}`;
    }

    // For arrays
    if (propSchema.type === 'array') {
      return `"${propName}": [\n  $0\n]`;
    }

    // For simple types with value
    if (value !== undefined) {
      const formattedValue = CompletionHelper.formatValueForJson(value, propSchema.type);
      return `"${propName}": \${1:${formattedValue}}`;
    }

    // For simple types without value - use placeholder
    const placeholder = this.getTypePlaceholder(propSchema.type);
    return `"${propName}": \${1:${placeholder}}`;
  }

  /**
   * Get default value snippet with tab stop
   */
  private getDefaultValueSnippet(schema: SchemaProperty, tabStop: number): string {
    const value = schema['x-f5xc-recommended-value'] ?? schema.default;

    if (value !== undefined) {
      const formatted = CompletionHelper.formatValueForJson(value, schema.type);
      return `\${${tabStop}:${formatted}}`;
    }

    const placeholder = this.getTypePlaceholder(schema.type);
    return `\${${tabStop}:${placeholder}}`;
  }

  /**
   * Get type placeholder
   */
  private getTypePlaceholder(type: string | string[] | undefined): string {
    const primaryType = Array.isArray(type) ? type[0] : type;

    switch (primaryType) {
      case 'string':
        return '""';
      case 'number':
      case 'integer':
        return '0';
      case 'boolean':
        return 'false';
      case 'array':
        return '[]';
      case 'object':
        return '{}';
      default:
        return '""';
    }
  }

  /**
   * Get property detail text
   */
  private getPropertyDetail(schema: SchemaProperty, isRequired: boolean): string {
    const parts: string[] = [];

    if (isRequired) {
      parts.push('required');
    }

    const typeStr = Array.isArray(schema.type) ? schema.type.join('|') : schema.type;
    if (typeStr) {
      parts.push(typeStr);
    }

    return parts.join(', ');
  }
}
