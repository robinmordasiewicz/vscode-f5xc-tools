// Copyright (c) 2026 Robin Mordasiewicz. MIT License.

import * as vscode from 'vscode';
import { ProfileManager, Profile } from '../config/profiles';
import { F5XCTreeItem } from './treeTypes';

/**
 * Tree data provider for the Profiles view
 */
export class ProfilesProvider implements vscode.TreeDataProvider<ProfileTreeItem> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<ProfileTreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private readonly profileManager: ProfileManager) {}

  getTreeItem(element: ProfileTreeItem): vscode.TreeItem {
    return element.getTreeItem();
  }

  async getChildren(element?: ProfileTreeItem): Promise<ProfileTreeItem[]> {
    if (element) {
      return [];
    }

    const profiles = await this.profileManager.getProfiles();
    const activeName = await this.profileManager.getActiveProfileName();

    return profiles.map((profile) => new ProfileTreeItem(profile, profile.name === activeName));
  }

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }
}

/**
 * Profile tree item
 */
export class ProfileTreeItem implements F5XCTreeItem {
  constructor(
    private readonly profile: Profile,
    private readonly isActive: boolean,
  ) {}

  getTreeItem(): vscode.TreeItem {
    const label = this.isActive ? `${this.profile.name} (active)` : this.profile.name;

    const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);

    item.contextValue = 'profile';
    item.iconPath = new vscode.ThemeIcon(this.isActive ? 'star-full' : 'account');
    item.tooltip = this.buildTooltip();
    item.description = this.profile.apiUrl;

    // Click to activate profile (only if not already active)
    if (!this.isActive) {
      item.command = {
        command: 'f5xc.setActiveProfile',
        title: 'Set as Active Profile',
        arguments: [this],
      };
    }

    return item;
  }

  getChildren(): Promise<F5XCTreeItem[]> {
    return Promise.resolve([]);
  }

  getProfile(): Profile {
    return this.profile;
  }

  private buildTooltip(): string {
    const lines = [
      `Name: ${this.profile.name}`,
      `URL: ${this.profile.apiUrl}`,
      `Auth: ${this.getAuthTypeDescription()}`,
    ];

    if (this.profile.defaultNamespace) {
      lines.push(`Default Namespace: ${this.profile.defaultNamespace}`);
    }

    if (this.profile.p12Bundle) {
      lines.push(`P12 Bundle: ${this.profile.p12Bundle}`);
    }

    if (this.profile.cert) {
      lines.push(`Certificate: ${this.profile.cert}`);
    }

    if (this.profile.key) {
      lines.push(`Private Key: ${this.profile.key}`);
    }

    if (this.isActive) {
      lines.push('Status: Active');
    }

    return lines.join('\n');
  }

  private getAuthTypeDescription(): string {
    if (this.profile.apiToken) {
      return 'API Token';
    }
    if (this.profile.p12Bundle) {
      return 'P12 Certificate';
    }
    if (this.profile.cert && this.profile.key) {
      return 'Certificate + Key';
    }
    return 'Not configured';
  }
}
