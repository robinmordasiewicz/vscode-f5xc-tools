/**
 * Subscription tree data provider
 * Provides a separate top-level view for Plan and Quotas
 */

import * as vscode from 'vscode';
import { ProfileManager } from '../config/profiles';
import { F5XCTreeItem } from './treeTypes';
import { PlanNode, QuotasNode } from './subscriptionNodes';

/**
 * Tree data provider for the Subscription view
 * Shows Plan and Quotas as top-level items
 */
export class SubscriptionProvider implements vscode.TreeDataProvider<F5XCTreeItem> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<F5XCTreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private readonly profileManager: ProfileManager) {}

  getTreeItem(element: F5XCTreeItem): vscode.TreeItem {
    return element.getTreeItem();
  }

  async getChildren(element?: F5XCTreeItem): Promise<F5XCTreeItem[]> {
    if (element) {
      return element.getChildren();
    }

    // Root level - return Plan and Quotas nodes if there's an active profile
    const activeProfile = this.profileManager.getActiveProfile();
    if (!activeProfile) {
      return [];
    }

    return [new PlanNode(activeProfile.name), new QuotasNode(activeProfile.name)];
  }

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }
}
