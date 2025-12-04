import * as vscode from 'vscode';
import { ProfileManager, F5XCProfile } from '../config/profiles';
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

  getChildren(element?: ProfileTreeItem): Promise<ProfileTreeItem[]> {
    if (element) {
      return Promise.resolve([]);
    }

    const profiles = this.profileManager.getProfiles();
    return Promise.resolve(profiles.map((profile) => new ProfileTreeItem(profile)));
  }

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }
}

/**
 * Profile tree item
 */
export class ProfileTreeItem implements F5XCTreeItem {
  constructor(private readonly profile: F5XCProfile) {}

  getTreeItem(): vscode.TreeItem {
    const label = this.profile.isActive ? `${this.profile.name} (active)` : this.profile.name;

    const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);

    item.contextValue = 'profile';
    item.iconPath = new vscode.ThemeIcon(this.profile.isActive ? 'star-full' : 'account');
    item.tooltip = this.buildTooltip();
    item.description = this.profile.apiUrl;

    // Click to activate profile (only if not already active)
    if (!this.profile.isActive) {
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

  getProfile(): F5XCProfile {
    return this.profile;
  }

  private buildTooltip(): string {
    const lines = [
      `Name: ${this.profile.name}`,
      `URL: ${this.profile.apiUrl}`,
      `Auth Type: ${this.profile.authType}`,
    ];

    if (this.profile.authType === 'p12' && this.profile.p12Path) {
      lines.push(`P12 File: ${this.profile.p12Path}`);
    }

    if (this.profile.isActive) {
      lines.push('Status: Active');
    }

    return lines.join('\n');
  }
}
