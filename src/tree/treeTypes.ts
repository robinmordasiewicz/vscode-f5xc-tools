// Copyright (c) 2026 Robin Mordasiewicz. MIT License.

import * as vscode from 'vscode';
import { ResourceCategory, ResourceTypeInfo } from '../api/resourceTypes';

/**
 * Base interface for all tree items
 */
export interface F5XCTreeItem {
  /** Get the VSCode TreeItem representation */
  getTreeItem(): vscode.TreeItem;

  /** Get child items */
  getChildren(): Promise<F5XCTreeItem[]>;
}

/**
 * Context value prefixes for tree items
 */
export const TreeItemContext = {
  NAMESPACE_GROUP: 'namespaceGroup',
  NAMESPACE: 'namespace',
  NAMESPACE_BUILTIN: 'namespace:builtin',
  NAMESPACE_CUSTOM: 'namespace:custom',
  CATEGORY: 'category',
  RESOURCE_TYPE: 'resourceType',
  RESOURCE: 'resource',
  // Subscription section contexts
  SUBSCRIPTION_GROUP: 'subscriptionGroup',
  SUBSCRIPTION_PLAN: 'subscriptionPlan',
  SUBSCRIPTION_QUOTAS: 'subscriptionQuotas',
  // Error display
  ERROR: 'error',
} as const;

/**
 * Namespace node data
 */
export interface NamespaceNodeData {
  name: string;
  profileName: string;
  isBuiltIn?: boolean;
}

/**
 * Category node data
 */
export interface CategoryNodeData {
  category: ResourceCategory;
  namespace: string;
  profileName: string;
}

/**
 * Resource type node data
 */
export interface ResourceTypeNodeData {
  resourceType: ResourceTypeInfo;
  resourceTypeKey: string;
  namespace: string;
  profileName: string;
}

/**
 * Resource node data
 */
export interface ResourceNodeData {
  name: string;
  namespace: string;
  resourceType: ResourceTypeInfo;
  resourceTypeKey: string;
  profileName: string;
  metadata?: Record<string, unknown>;
  /** Full resource data from list response (for resources without GET endpoint) */
  fullResourceData?: Record<string, unknown>;
}
