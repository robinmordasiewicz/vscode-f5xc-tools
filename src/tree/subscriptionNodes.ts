// Copyright (c) 2026 Robin Mordasiewicz. MIT License.

/**
 * Subscription tree nodes for Plan and Quota sections
 */

import * as vscode from 'vscode';
import { F5XCTreeItem, TreeItemContext } from './treeTypes';

/**
 * Top-level Subscription group node
 * Contains Plan and Quotas sub-nodes
 */
export class SubscriptionGroupNode implements F5XCTreeItem {
  constructor(private readonly profileName: string) {}

  getTreeItem(): vscode.TreeItem {
    const item = new vscode.TreeItem('Subscription', vscode.TreeItemCollapsibleState.Collapsed);
    item.contextValue = TreeItemContext.SUBSCRIPTION_GROUP;
    item.iconPath = new vscode.ThemeIcon('credit-card');
    item.tooltip = 'View subscription plan and quota usage';
    return item;
  }

  getChildren(): Promise<F5XCTreeItem[]> {
    return Promise.resolve([new PlanNode(this.profileName), new QuotasNode(this.profileName)]);
  }
}

/**
 * Plan node - displays current subscription tier and addons
 * Opens Plan dashboard webview on click
 */
export class PlanNode implements F5XCTreeItem {
  constructor(private readonly profileName: string) {}

  getTreeItem(): vscode.TreeItem {
    const item = new vscode.TreeItem('Plan', vscode.TreeItemCollapsibleState.None);
    item.contextValue = TreeItemContext.SUBSCRIPTION_PLAN;
    item.iconPath = new vscode.ThemeIcon('file-text');
    item.tooltip = 'View subscription plan details and addon services';
    item.command = {
      command: 'f5xc.showPlan',
      title: 'Show Subscription Plan',
      arguments: [this.profileName],
    };
    return item;
  }

  getChildren(): Promise<F5XCTreeItem[]> {
    // Leaf node - no children
    return Promise.resolve([]);
  }

  get profile(): string {
    return this.profileName;
  }
}

/**
 * Quotas node - displays resource usage vs limits
 * Opens Quotas dashboard webview on click
 */
export class QuotasNode implements F5XCTreeItem {
  constructor(private readonly profileName: string) {}

  getTreeItem(): vscode.TreeItem {
    const item = new vscode.TreeItem('Quotas', vscode.TreeItemCollapsibleState.None);
    item.contextValue = TreeItemContext.SUBSCRIPTION_QUOTAS;
    item.iconPath = new vscode.ThemeIcon('graph');
    item.tooltip = 'View resource quota usage and limits';
    item.command = {
      command: 'f5xc.showQuotas',
      title: 'Show Quota Usage',
      arguments: [this.profileName],
    };
    return item;
  }

  getChildren(): Promise<F5XCTreeItem[]> {
    // Leaf node - no children
    return Promise.resolve([]);
  }

  get profile(): string {
    return this.profileName;
  }
}
