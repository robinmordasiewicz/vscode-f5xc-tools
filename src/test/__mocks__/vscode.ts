// Copyright (c) 2026 Robin Mordasiewicz. MIT License.

/**
 * VSCode API mock for Jest unit tests
 * This mock provides basic implementations of VSCode APIs used by the extension
 */

// Mock EventEmitter
export class EventEmitter<T> {
  private listeners: Array<(e: T) => void> = [];

  event = (listener: (e: T) => void) => {
    this.listeners.push(listener);
    return {
      dispose: () => {
        const index = this.listeners.indexOf(listener);
        if (index >= 0) {
          this.listeners.splice(index, 1);
        }
      },
    };
  };

  fire(data: T): void {
    this.listeners.forEach((listener) => listener(data));
  }

  dispose(): void {
    this.listeners = [];
  }
}

// Mock Uri
export const Uri = {
  file: (path: string) => ({
    fsPath: path,
    path,
    scheme: 'file',
    authority: '',
    query: '',
    fragment: '',
    with: jest.fn(),
    toString: () => `file://${path}`,
  }),
  parse: (value: string) => ({
    fsPath: value,
    path: value,
    scheme: 'file',
    authority: '',
    query: '',
    fragment: '',
    with: jest.fn(),
    toString: () => value,
  }),
  joinPath: (base: { fsPath: string }, ...pathSegments: string[]) => {
    const fullPath = [base.fsPath, ...pathSegments].join('/');
    return Uri.file(fullPath);
  },
};

// Mock TreeItem
export class TreeItem {
  label?: string | { label: string };
  id?: string;
  iconPath?: string | { light: string; dark: string };
  description?: string;
  tooltip?: string;
  command?: { command: string; title: string; arguments?: unknown[] };
  contextValue?: string;
  collapsibleState?: TreeItemCollapsibleState;
  resourceUri?: typeof Uri;

  constructor(label: string | { label: string }, collapsibleState?: TreeItemCollapsibleState) {
    this.label = label;
    this.collapsibleState = collapsibleState;
  }
}

// Mock TreeItemCollapsibleState
export enum TreeItemCollapsibleState {
  None = 0,
  Collapsed = 1,
  Expanded = 2,
}

// Mock ThemeIcon
export class ThemeIcon {
  static readonly File = new ThemeIcon('file');
  static readonly Folder = new ThemeIcon('folder');

  constructor(
    public readonly id: string,
    public readonly color?: ThemeColor,
  ) {}
}

// Mock ThemeColor
export class ThemeColor {
  constructor(public readonly id: string) {}
}

// Mock SecretStorage
export const mockSecretStorage = {
  get: jest.fn(),
  store: jest.fn(),
  delete: jest.fn(),
  onDidChange: jest.fn(),
};

// Mock Memento (globalState/workspaceState)
export const mockMemento = {
  get: jest.fn(),
  update: jest.fn(),
  keys: jest.fn(() => []),
};

// Mock ExtensionContext
export const mockExtensionContext = {
  subscriptions: [],
  workspaceState: mockMemento,
  globalState: { ...mockMemento, setKeysForSync: jest.fn() },
  secrets: mockSecretStorage,
  extensionUri: Uri.file('/mock/extension'),
  extensionPath: '/mock/extension',
  storagePath: '/mock/storage',
  globalStoragePath: '/mock/global-storage',
  logPath: '/mock/log',
  extensionMode: 1,
  environmentVariableCollection: {
    replace: jest.fn(),
    append: jest.fn(),
    prepend: jest.fn(),
    get: jest.fn(),
    forEach: jest.fn(),
    delete: jest.fn(),
    clear: jest.fn(),
  },
  asAbsolutePath: (relativePath: string) => `/mock/extension/${relativePath}`,
};

// Mock window
export const window = {
  showInformationMessage: jest.fn(),
  showWarningMessage: jest.fn(),
  showErrorMessage: jest.fn(),
  showInputBox: jest.fn(),
  showQuickPick: jest.fn(),
  showOpenDialog: jest.fn(),
  showSaveDialog: jest.fn(),
  createOutputChannel: jest.fn(() => ({
    appendLine: jest.fn(),
    append: jest.fn(),
    clear: jest.fn(),
    show: jest.fn(),
    hide: jest.fn(),
    dispose: jest.fn(),
  })),
  createTreeView: jest.fn(() => ({
    reveal: jest.fn(),
    dispose: jest.fn(),
    onDidChangeSelection: jest.fn(),
    onDidChangeVisibility: jest.fn(),
    onDidCollapseElement: jest.fn(),
    onDidExpandElement: jest.fn(),
  })),
  registerTreeDataProvider: jest.fn(),
  withProgress: jest.fn((_options, task) =>
    task({ report: jest.fn() }, { isCancellationRequested: false }),
  ),
  activeTextEditor: undefined,
  visibleTextEditors: [],
  onDidChangeActiveTextEditor: jest.fn(),
  createTextEditorDecorationType: jest.fn(() => ({
    dispose: jest.fn(),
  })),
  showTextDocument: jest.fn(),
};

// Mock workspace
export const workspace = {
  getConfiguration: jest.fn(() => ({
    get: jest.fn(),
    has: jest.fn(),
    inspect: jest.fn(),
    update: jest.fn(),
  })),
  workspaceFolders: [],
  onDidChangeConfiguration: jest.fn(),
  openTextDocument: jest.fn(),
  fs: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    delete: jest.fn(),
    createDirectory: jest.fn(),
    readDirectory: jest.fn(),
    stat: jest.fn(),
  },
};

// Mock commands
export const commands = {
  registerCommand: jest.fn(),
  executeCommand: jest.fn(),
  getCommands: jest.fn(),
};

// Mock env
export const env = {
  clipboard: {
    readText: jest.fn(),
    writeText: jest.fn(),
  },
  openExternal: jest.fn(),
  uriScheme: 'vscode',
  language: 'en',
  machineId: 'mock-machine-id',
  sessionId: 'mock-session-id',
  appName: 'Visual Studio Code',
  appRoot: '/mock/app',
};

// Mock ProgressLocation
export enum ProgressLocation {
  SourceControl = 1,
  Window = 10,
  Notification = 15,
}

// Mock ConfigurationTarget
export enum ConfigurationTarget {
  Global = 1,
  Workspace = 2,
  WorkspaceFolder = 3,
}

// Mock Disposable
export class Disposable {
  constructor(private callOnDispose: () => void) {}

  static from(...disposables: { dispose: () => void }[]): Disposable {
    return new Disposable(() => {
      disposables.forEach((d) => d.dispose());
    });
  }

  dispose(): void {
    this.callOnDispose();
  }
}

// Mock CancellationTokenSource
export class CancellationTokenSource {
  token = {
    isCancellationRequested: false,
    onCancellationRequested: jest.fn(),
  };

  cancel(): void {
    this.token.isCancellationRequested = true;
  }

  dispose(): void {}
}

// Mock Range and Position
export class Position {
  constructor(
    public readonly line: number,
    public readonly character: number,
  ) {}

  isAfter(other: Position): boolean {
    return this.line > other.line || (this.line === other.line && this.character > other.character);
  }

  isBefore(other: Position): boolean {
    return this.line < other.line || (this.line === other.line && this.character < other.character);
  }

  isEqual(other: Position): boolean {
    return this.line === other.line && this.character === other.character;
  }

  translate(lineDelta?: number, characterDelta?: number): Position {
    return new Position(this.line + (lineDelta || 0), this.character + (characterDelta || 0));
  }

  with(line?: number, character?: number): Position {
    return new Position(line ?? this.line, character ?? this.character);
  }
}

export class Range {
  constructor(
    public readonly start: Position,
    public readonly end: Position,
  ) {}

  get isEmpty(): boolean {
    return this.start.isEqual(this.end);
  }

  get isSingleLine(): boolean {
    return this.start.line === this.end.line;
  }

  contains(positionOrRange: Position | Range): boolean {
    if (positionOrRange instanceof Position) {
      return !positionOrRange.isBefore(this.start) && !positionOrRange.isAfter(this.end);
    }
    return this.contains(positionOrRange.start) && this.contains(positionOrRange.end);
  }
}

// Export default for CommonJS compatibility
export default {
  EventEmitter,
  Uri,
  TreeItem,
  TreeItemCollapsibleState,
  ThemeIcon,
  ThemeColor,
  window,
  workspace,
  commands,
  env,
  ProgressLocation,
  ConfigurationTarget,
  Disposable,
  CancellationTokenSource,
  Position,
  Range,
};
