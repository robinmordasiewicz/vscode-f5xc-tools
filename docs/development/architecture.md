# Architecture

Understanding the F5 Distributed Cloud Tools extension architecture and design
patterns.

## Overview

F5 Distributed Cloud Tools is a TypeScript-based VS Code extension that provides
a complete interface for managing F5 XC resources through tree views, commands,
and API integration.

### Design Principles

- **Layered Architecture**: Clear separation between UI, commands, API, and
  configuration
- **Type Safety**: Full TypeScript with strict mode for compile-time error
  detection
- **Lazy Loading**: Resources loaded on-demand to minimize memory usage
- **Secure by Default**: Credentials stored in VS Code SecretStorage, never in
  settings
- **Extensible**: Auto-generated resource types from OpenAPI specifications

## Layered Structure

```text
src/extension.ts                    # Entry point (activate/deactivate)
        │
        ├── commands/               # Command handlers
        │   ├── crud.ts             # Resource operations (get, edit, create, apply, delete, diff)
        │   └── profile.ts          # Profile management (add, edit, delete, setActive)
        │
        ├── tree/                   # Tree view providers
        │   ├── f5xcExplorer.ts     # Resource explorer (Namespace → Category → ResourceType → Resource)
        │   └── profilesProvider.ts # Profile list view
        │
        ├── api/                    # API layer
        │   ├── client.ts           # F5XCClient - REST operations (create, get, list, replace, delete)
        │   ├── resourceTypes.ts    # RESOURCE_TYPES registry (236 F5 XC resource types)
        │   └── auth/               # Authentication providers
        │       ├── tokenAuth.ts    # API Token auth (Authorization: APIToken {token})
        │       └── certAuth.ts     # P12 certificate auth (mTLS via node-forge)
        │
        ├── config/
        │   └── profiles.ts         # ProfileManager - credentials in VSCode SecretStorage
        │
        ├── utils/
        │   ├── logger.ts           # Logging infrastructure
        │   ├── errors.ts           # Error types and handling
        │   └── validation.ts       # JSON schema validation
        │
        └── generated/              # Auto-generated from OpenAPI specs
            ├── resourceTypesBase.ts # Base resource type definitions
            ├── domainCategories.ts  # Domain to category mappings
            └── constants.ts         # API endpoints and built-in namespaces
```

## Core Components

### Extension Entry Point

**File**: `src/extension.ts`

```typescript
export function activate(context: vscode.ExtensionContext) {
  // Initialize configuration and state
  const profileManager = new ProfileManager(context);

  // Register tree view providers
  const explorerProvider = new F5XCExplorerProvider(profileManager);
  const profilesProvider = new ProfilesProvider(profileManager);

  // Register commands
  registerCommands(context, profileManager, explorerProvider);

  // Activate tree views
  vscode.window.registerTreeDataProvider('f5xcExplorer', explorerProvider);
  vscode.window.registerTreeDataProvider('f5xcProfiles', profilesProvider);
}
```

**Responsibilities:**

- Extension lifecycle management (activate/deactivate)
- Component initialization and wiring
- VS Code API integration

### Tree View Providers

#### F5XCExplorerProvider

**File**: `src/tree/f5xcExplorer.ts`

Hierarchical resource tree with lazy loading:

```text
Resources
├── 📁 Namespace: default
│   ├── 📂 Load Balancing
│   │   ├── 📄 HTTP Load Balancers
│   │   │   ├── my-app-lb
│   │   │   └── api-gateway-lb
│   │   └── 📄 Origin Pools
│   ├── 📂 Security
│   │   ├── 📄 App Firewalls
│   │   └── 📄 Service Policies
│   └── ...
└── 📁 Namespace: production
```

**Node Types:**

- `NamespaceNode`: Top-level namespace containers
- `CategoryNode`: Resource category groupings (Load Balancing, Security, etc.)
- `ResourceTypeNode`: Specific resource types (HTTP Load Balancers, Origin
  Pools)
- `ResourceNode`: Individual resource instances

**Lazy Loading Strategy:**

1. Initially load namespaces only
2. On namespace expansion, load categories
3. On category expansion, load resource types
4. On resource type expansion, fetch resource list from API
5. Cache results until refresh

#### ProfilesProvider

**File**: `src/tree/profilesProvider.ts`

Simple list view for profile management:

```text
Profiles
├── ✓ my-tenant-dev (Active)
├── my-tenant-staging
└── my-tenant-prod
```

**Features:**

- Active profile indication (checkmark)
- Context menu actions (Set Active, Edit, Delete)
- Automatic refresh on profile changes

### Command System

**Files**: `src/commands/*.ts`

Commands registered in `package.json` and implemented with error handling:

```typescript
// Command registration
vscode.commands.registerCommand(
  'f5xc.getResource',
  withErrorHandling(getResource),
);

// Error handling wrapper
async function withErrorHandling<T>(
  fn: () => Promise<T>,
): Promise<T | undefined> {
  try {
    return await fn();
  } catch (error) {
    handleError(error);
    return undefined;
  }
}
```

**Command Categories:**

| Category     | Commands                               | Implementation         |
| ------------ | -------------------------------------- | ---------------------- |
| **CRUD**     | get, create, edit, apply, delete, diff | `commands/crud.ts`     |
| **Profile**  | add, edit, delete, setActive           | `commands/profile.ts`  |
| **Explorer** | refresh, expand, collapse              | `tree/f5xcExplorer.ts` |

### API Layer

#### F5XCClient

**File**: `src/api/client.ts`

REST API client with authentication provider abstraction:

```typescript
class F5XCClient {
  constructor(
    private apiUrl: string,
    private authProvider: AuthProvider,
  ) {}

  async list(resourceType: string, namespace: string): Promise<Resource[]>;
  async get(
    resourceType: string,
    namespace: string,
    name: string,
  ): Promise<Resource>;
  async create(
    resourceType: string,
    namespace: string,
    spec: ResourceSpec,
  ): Promise<Resource>;
  async replace(
    resourceType: string,
    namespace: string,
    name: string,
    spec: ResourceSpec,
  ): Promise<Resource>;
  async delete(
    resourceType: string,
    namespace: string,
    name: string,
  ): Promise<void>;
}
```

**Request Flow:**

1. Command invoked (e.g., "Get Resource")
2. F5XCClient constructs API request
3. AuthProvider adds authentication headers/certificates
4. HTTPS request sent to F5 XC API
5. Response parsed and returned
6. UI updated with results

#### Resource Types Registry

**File**: `src/api/resourceTypes.ts`

Central registry mapping resource keys to metadata:

```typescript
export const RESOURCE_TYPES: Record<string, ResourceTypeInfo> = {
  http_loadbalancer: {
    apiPath: 'http_loadbalancers',
    displayName: 'HTTP Load Balancers',
    category: ResourceCategory.LoadBalancing,
    description: 'Layer 7 load balancing with TLS termination',
    apiBase: 'config',
    namespaceScope: 'any',
    supportsCustomOps: true,
    supportsLogs: true,
    supportsMetrics: true,
    schemaFile: 'ves.io.schema.http_loadbalancer.json',
  },
  // ... 235 more resource types
};
```

**Features:**

- Auto-generated from OpenAPI specifications
- Category mapping for tree view organization
- Namespace scope restrictions (any, system, shared)
- Feature flags (logs, metrics, custom operations)
- Operation metadata (prerequisites, dangers, side effects)

### Authentication System

**File**: `src/api/auth/index.ts`

Provider-based authentication abstraction:

```typescript
interface AuthProvider {
  readonly type: 'token' | 'cert';
  getHeaders(): Record<string, string>;
  getHttpsAgent(): https.Agent | undefined;
  validate(): Promise<boolean>;
  dispose(): void;
}
```

#### Token Authentication

**File**: `src/api/auth/tokenAuth.ts`

```typescript
class TokenAuthProvider implements AuthProvider {
  getHeaders(): Record<string, string> {
    return {
      Authorization: `APIToken ${this.apiToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }
}
```

**Request Example:**

```http
GET /api/web/namespaces HTTP/1.1
Host: tenant.console.ves.volterra.io
Authorization: APIToken abc123...
```

#### Certificate Authentication

**File**: `src/api/auth/certAuth.ts`

```typescript
class CertAuthProvider implements AuthProvider {
  getHttpsAgent(): https.Agent {
    // Parse P12 bundle with node-forge
    const p12 = forge.pkcs12.pkcs12FromAsn1(...);
    const cert = extractCertificate(p12);
    const key = extractPrivateKey(p12);

    return new https.Agent({
      cert: forge.pki.certificateToPem(cert),
      key: forge.pki.privateKeyToPem(key),
      rejectUnauthorized: true
    });
  }
}
```

**mTLS Handshake:**

1. Client presents P12 certificate during TLS handshake
2. F5 XC validates certificate against trusted CAs
3. Secure TLS connection established
4. No Authorization header needed (authentication via certificate)

### Profile Management

**File**: `src/config/profiles.ts`

Manages tenant connection profiles with secure credential storage:

```typescript
class ProfileManager {
  private profiles: Map<string, Profile>;

  async addProfile(profile: Profile): Promise<void> {
    // Store profile metadata in VS Code settings
    await this.updateSettings(profile);

    // Store credentials in SecretStorage
    if (profile.authType === 'token') {
      await this.storeToken(profile.name, profile.apiToken);
    } else {
      await this.storeP12Password(profile.name, profile.p12Password);
    }
  }

  async getActiveProfile(): Promise<Profile | undefined>;
  async setActiveProfile(name: string): Promise<void>;
  async deleteProfile(name: string): Promise<void>;
}
```

**Storage Strategy:**

| Data Type        | Storage Location      | Security                 |
| ---------------- | --------------------- | ------------------------ |
| Profile metadata | VS Code settings.json | Plain text (no secrets)  |
| API tokens       | VS Code SecretStorage | Encrypted by OS keychain |
| P12 passwords    | VS Code SecretStorage | Encrypted by OS keychain |
| P12 file paths   | VS Code settings.json | Path only, not contents  |

**OS Keychain Integration:**

- **macOS**: Keychain Access
- **Linux**: GNOME Keyring / KWallet (Secret Service API)
- **Windows**: Windows Credential Manager

### Auto-Generated Types

**Directory**: `src/generated/`

Types and metadata auto-generated from F5 XC OpenAPI specifications:

#### Resource Types Base

**File**: `src/generated/resourceTypesBase.ts`

```typescript
export const GENERATED_RESOURCE_TYPES: Record<string, GeneratedResourceTypeInfo> = {
  http_loadbalancer: {
    apiPath: 'http_loadbalancers',
    displayName: 'HTTP Load Balancers',
    description: 'Layer 7 load balancing with TLS termination',
    apiBase: 'config',
    domain: 'load_balancing',
    schemaFile: 'ves.io.schema.http_loadbalancer.json',
    operationMetadata: {
      create: {
        dangerLevel: 'medium',
        sideEffects: ['Creates public endpoint', 'Incurs traffic costs'],
        prerequisites: ['Origin pool must exist'],
        commonErrors: [...]
      }
    }
  }
};
```

**Generation Process:**

1. Fetch latest OpenAPI specs from F5 XC API
2. Parse schemas for resource definitions
3. Extract operation metadata (prerequisites, warnings, errors)
4. Generate TypeScript interfaces and constants
5. Map domains to UI categories
6. Preserve manual overrides for UI-specific properties

#### Domain Categories

**File**: `src/generated/domainCategories.ts`

Maps API domains to UI categories:

```typescript
export function getLocalCategoryForDomain(domain: string): ResourceCategory {
  const mapping: Record<string, ResourceCategory> = {
    load_balancing: ResourceCategory.LoadBalancing,
    security: ResourceCategory.Security,
    networking: ResourceCategory.Networking,
    sites: ResourceCategory.Sites,
    // ... 30+ domain mappings
  };
  return mapping[domain] || ResourceCategory.Configuration;
}
```

#### API Constants

**File**: `src/generated/constants.ts`

```typescript
export const API_ENDPOINTS = {
  NAMESPACES: '/api/web/namespaces',
  HTTP_LOADBALANCERS: '/api/config/namespaces/{namespace}/http_loadbalancers',
  ORIGIN_POOLS: '/api/config/namespaces/{namespace}/origin_pools',
  // ... 236 resource type endpoints
};

export const BUILT_IN_NAMESPACES = ['system', 'shared', 'ves-system'];
```

## Data Flow

### Resource List Flow

```text
User clicks namespace in tree
         ↓
F5XCExplorerProvider.getChildren(namespaceNode)
         ↓
Load categories for namespace (static)
         ↓
User expands "Load Balancing" category
         ↓
Load resource types for category (static)
         ↓
User expands "HTTP Load Balancers"
         ↓
F5XCClient.list('http_loadbalancer', 'default')
         ↓
AuthProvider.getHeaders() or getHttpsAgent()
         ↓
HTTPS GET /api/config/namespaces/default/http_loadbalancers
         ↓
Parse JSON response { items: [...] }
         ↓
Create ResourceNode for each item
         ↓
Display in tree view
```

### Resource Edit Flow

```text
User right-clicks resource → "Edit Resource"
         ↓
F5XCClient.get('http_loadbalancer', 'default', 'my-lb')
         ↓
HTTPS GET /api/config/namespaces/default/http_loadbalancers/my-lb
         ↓
Parse JSON response { spec: {...}, metadata: {...} }
         ↓
Open in JSON editor with schema validation
         ↓
User modifies and saves (Ctrl+S)
         ↓
Validate against JSON schema
         ↓
F5XCClient.replace('http_loadbalancer', 'default', 'my-lb', spec)
         ↓
HTTPS PUT /api/config/namespaces/default/http_loadbalancers/my-lb
         ↓
Success → Show notification, refresh tree
Error → Display error message with details
```

## Error Handling

### Error Types

**File**: `src/utils/errors.ts`

```typescript
class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

class ResourceNotFoundError extends Error {
  constructor(resourceType: string, name: string) {
    super(`${resourceType} '${name}' not found`);
    this.name = 'ResourceNotFoundError';
  }
}

class ValidationError extends Error {
  constructor(
    message: string,
    public errors: string[],
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}
```

### Error Handling Strategy

1. **API Errors**: HTTP status codes mapped to error types
2. **Validation Errors**: JSON schema validation failures
3. **Authentication Errors**: Token/certificate validation failures
4. **Network Errors**: Connection timeouts, DNS failures
5. **User Errors**: Invalid input, missing resources

**Error Display:**

- Error notifications in VS Code UI
- Detailed error messages in Output panel
- Actionable error suggestions ("Check credentials", "Verify API URL")

## State Management

### Extension State

**Storage**: VS Code ExtensionContext

```typescript
// Global state (persists across VS Code sessions)
context.globalState.update('activeProfile', profileName);

// Workspace state (per-workspace)
context.workspaceState.update('expandedNodes', nodeIds);
```

### Profile State

**Storage**: VS Code Settings + SecretStorage

```json
// settings.json (workspace or user)
{
  "f5xc.profiles": [
    {
      "name": "my-tenant-dev",
      "apiUrl": "https://tenant.console.ves.volterra.io",
      "authType": "token"
    }
  ],
  "f5xc.activeProfile": "my-tenant-dev"
}
```

**SecretStorage** (encrypted):

- `f5xc.profile.my-tenant-dev.apiToken`: "abc123..."
- `f5xc.profile.my-tenant-prod.p12Password`: "secret"

### Tree View State

**Managed by**: VS Code TreeView API

- Node expansion state
- Selected node
- Scroll position
- Automatic state persistence across sessions

## Extension Points

### Adding New Resource Types

1. **Update OpenAPI specs**: Fetch latest from F5 XC API
2. **Regenerate types**: Run generator script
3. **Review manual overrides**: Add UI-specific properties if needed
4. **Test**: Verify tree view, CRUD operations, validation

### Adding New Commands

1. **Register command** in `package.json`:

```json
{
  "command": "f5xc.myCommand",
  "title": "My Command",
  "category": "F5 XC"
}
```

2. **Implement handler** in `src/commands/`:

```typescript
export async function myCommand(node: ResourceNode) {
  // Command implementation
}
```

3. **Wire up** in `src/extension.ts`:

```typescript
context.subscriptions.push(
  vscode.commands.registerCommand('f5xc.myCommand', myCommand),
);
```

### Extending Tree Views

Implement custom tree node types:

```typescript
class MyCustomNode extends F5XCTreeItem {
  contextValue = 'myCustomNode';

  getChildren(): Thenable<F5XCTreeItem[]> {
    // Return child nodes
  }
}
```

Add context menu actions in `package.json`:

```json
{
  "menus": {
    "view/item/context": [
      {
        "command": "f5xc.myCommand",
        "when": "view == f5xcExplorer && viewItem == myCustomNode"
      }
    ]
  }
}
```

## Performance Considerations

### Lazy Loading

- Resources loaded on-demand (not all at once)
- Tree nodes created only when expanded
- API requests minimized with caching

### Caching Strategy

- Namespace list cached until explicit refresh
- Resource lists cached per resource type
- Resource details cached until edit/refresh
- Cache invalidation on create/update/delete

### Memory Management

- Large JSON responses streamed, not loaded entirely
- Tree nodes garbage collected when collapsed
- HTTPS agents reused per profile
- Credentials loaded from SecretStorage only when needed

## Security

### Credential Security

- **Never log credentials** in console or files
- **SecretStorage encryption** via OS keychain
- **No credential storage** in plain text settings
- **Memory cleanup** on profile switch or extension deactivate

### API Security

- **TLS 1.2+ required** for all connections
- **Certificate validation** enforced (rejectUnauthorized: true)
- **Token rotation** supported (update profile)
- **Session isolation** per VS Code workspace

### Input Validation

- **JSON schema validation** for all resource specs
- **API URL validation** (HTTPS only, valid hostname)
- **Resource name validation** (alphanumeric, hyphens)
- **Namespace validation** (exists in tenant)

## Next Steps

- [Build the extension](building.md)
- [Run tests](testing.md)
- [Contributing guidelines](contributing.md)
