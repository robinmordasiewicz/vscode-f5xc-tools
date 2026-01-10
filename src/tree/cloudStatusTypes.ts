// Copyright (c) 2026 Robin Mordasiewicz. MIT License.

/**
 * Cloud Status Tree Types
 * Types and interfaces for the Cloud Status tree view
 */

import * as vscode from 'vscode';

/**
 * Interface for Cloud Status tree items
 */
export interface CloudStatusTreeItem {
  getTreeItem(): vscode.TreeItem;
  getChildren(): Promise<CloudStatusTreeItem[]>;
}

/**
 * Context values for Cloud Status tree items
 * Used for menu contribution conditions in package.json
 */
export const CloudStatusContext = {
  ROOT: 'cloudStatusRoot',
  GROUP: 'cloudStatusGroup',
  COMPONENT: 'cloudStatusComponent',
  INCIDENTS_GROUP: 'cloudStatusIncidentsGroup',
  INCIDENT: 'cloudStatusIncident',
  MAINTENANCE_GROUP: 'cloudStatusMaintenanceGroup',
  MAINTENANCE: 'cloudStatusMaintenance',
  ERROR: 'cloudStatusError',
} as const;

export type CloudStatusContextType = (typeof CloudStatusContext)[keyof typeof CloudStatusContext];
