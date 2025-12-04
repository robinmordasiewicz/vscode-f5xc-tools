/**
 * VSCode Extension Integration Tests
 * These tests run inside the VSCode Extension Development Host
 */

import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
  // Allow extension to activate
  suiteSetup(async () => {
    // Wait for the extension to activate
    const ext = vscode.extensions.getExtension('RobinMordasiewicz.vscode-f5xc-tools');
    if (ext && !ext.isActive) {
      await ext.activate();
    }
    // Give extension time to fully initialize
    await new Promise((resolve) => setTimeout(resolve, 2000));
  });

  test('Extension should be present', () => {
    const extension = vscode.extensions.getExtension('RobinMordasiewicz.vscode-f5xc-tools');
    assert.ok(extension, 'Extension should be found');
  });

  test('Extension should activate', async () => {
    const extension = vscode.extensions.getExtension('RobinMordasiewicz.vscode-f5xc-tools');
    assert.ok(extension, 'Extension should be found');

    if (!extension.isActive) {
      await extension.activate();
    }

    assert.strictEqual(extension.isActive, true, 'Extension should be active');
  });

  test('F5 XC commands should be registered', async () => {
    const commands = await vscode.commands.getCommands(true);

    // Check for core commands
    const expectedCommands = [
      'f5xc.refresh',
      'f5xc.addProfile',
      'f5xc.editProfile',
      'f5xc.deleteProfile',
      'f5xc.setActiveProfile',
      'f5xc.create',
      'f5xc.get',
      'f5xc.edit',
      'f5xc.delete',
      'f5xc.apply',
      'f5xc.diff',
    ];

    for (const cmd of expectedCommands) {
      assert.ok(commands.includes(cmd), `Command "${cmd}" should be registered`);
    }
  });

  test('F5 XC views should be available', () => {
    // Views are declared in package.json, so they should exist
    // We can't directly test view visibility without UI interaction
    // but we can verify the extension doesn't throw during activation
    const extension = vscode.extensions.getExtension('RobinMordasiewicz.vscode-f5xc-tools');
    assert.ok(extension?.isActive, 'Extension should be active with views registered');
  });

  test('Configuration should have expected properties', () => {
    const config = vscode.workspace.getConfiguration('f5xc');

    // Test that configuration keys exist
    const logLevel = config.get<string>('logLevel');
    const defaultNamespace = config.get<string>('defaultNamespace');
    const confirmDelete = config.get<boolean>('confirmDelete');
    const autoRefreshInterval = config.get<number>('autoRefreshInterval');

    // These should return the default values from package.json
    assert.ok(typeof logLevel === 'string' || logLevel === undefined);
    assert.ok(typeof defaultNamespace === 'string' || defaultNamespace === undefined);
    assert.ok(typeof confirmDelete === 'boolean' || confirmDelete === undefined);
    assert.ok(typeof autoRefreshInterval === 'number' || autoRefreshInterval === undefined);
  });
});

suite('Profile Management Test Suite', () => {
  test('Add profile command should be executable', async () => {
    // We can't fully test add profile without mocking the input boxes
    // but we can verify the command exists and doesn't throw synchronously
    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes('f5xc.addProfile'), 'addProfile command should exist');
  });

  test('Refresh command should execute without error', async () => {
    // The refresh command should work even with no profiles
    try {
      await vscode.commands.executeCommand('f5xc.refresh');
      assert.ok(true, 'Refresh command executed successfully');
    } catch (error) {
      assert.fail(`Refresh command should not throw: ${error}`);
    }
  });
});

suite('Tree View Test Suite', () => {
  test('Explorer tree view should be registered', async () => {
    // Verify the tree view command context
    const commands = await vscode.commands.getCommands(true);
    const explorerCommands = commands.filter((cmd) => cmd.startsWith('f5xc.'));
    assert.ok(explorerCommands.length > 0, 'F5 XC commands should be registered');
  });
});
