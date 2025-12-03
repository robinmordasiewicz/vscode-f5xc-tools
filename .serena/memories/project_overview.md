# F5 Distributed Cloud Tools - VSCode Extension

## Purpose
A VSCode extension for managing F5 Distributed Cloud (F5 XC) resources directly from the IDE. It provides:
- CRUD operations for F5 XC resources (HTTP Load Balancers, Origin Pools, App Firewalls, etc.)
- Profile management with secure credential storage
- Tree view explorer for browsing namespaces and resources
- Support for 40+ F5 XC resource types organized by category

## Tech Stack
- **Language**: TypeScript
- **Runtime**: VSCode Extension API (Node.js)
- **Build Tool**: Webpack
- **Testing**: Jest (unit), VSCode Test Framework (integration)
- **Linting**: ESLint with TypeScript plugin
- **Package Manager**: npm

## Key Dependencies
- `node-forge`: P12 certificate parsing for mTLS authentication
- `ajv` / `ajv-formats`: JSON Schema validation
- VSCode API: Tree views, commands, secret storage, webviews

## Authentication Methods
1. **API Token**: Bearer token authentication (`Authorization: APIToken {token}`)
2. **P12 Certificate**: mTLS authentication using PKCS#12 certificate files

## Architecture
The extension follows a layered architecture:
```
Presentation Layer (Tree Views, Commands)
    ↓
Business Logic Layer (Profile Manager, Resource Handlers)
    ↓
API Abstraction Layer (F5XC Client, Auth Providers)
    ↓
Configuration Layer (Profiles, Settings)
```
