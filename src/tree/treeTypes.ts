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
  CATEGORY: 'category',
  RESOURCE_TYPE: 'resourceType',
  RESOURCE: 'resource',
} as const;

/**
 * Namespace node data
 */
export interface NamespaceNodeData {
  name: string;
  profileName: string;
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
}
