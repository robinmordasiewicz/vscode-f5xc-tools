# Changelog

All notable changes to the F5 Distributed Cloud Tools extension will be
documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.7] - 2024-12-04

### Fixed

- Fixed Edit Resource command creating invalid file URI that caused "read-only
  file system" error when saving
- Added hint message explaining how to apply changes using "F5 XC: Apply"
  command

## [0.1.6] - 2024-12-04

### Improved

- Clicking on a profile in the Profiles list now automatically sets it as the
  active profile and refreshes the Resources view

## [0.1.5] - 2024-12-04

### Fixed

- Fixed View Logs sort order enum value for F5 XC API compatibility

## [0.1.4] - 2024-12-04

### Added

- View Logs command - displays access logs for HTTP/TCP load balancers
- View Metrics command - displays metrics for load balancers and origin pools

## [0.1.3] - 2024-12-04

### Added

- Console View mode - displays clean JSON output matching F5 Distributed Cloud
  Console (filters out system metadata, null values, and internal fields)
- Toggle View Mode command (`F5 XC: Toggle View Mode`) to switch between Console
  and Full API views
- New `f5xc.viewMode` setting to control default resource display mode

## [0.1.2] - 2024-12-04

### Fixed

- Resource names now correctly displayed in tree view instead of "unknown"
  (improved handling of multiple F5 XC API response formats)

## [0.1.1] - 2024-12-04

### Fixed

- Input dialogs no longer cancel when switching windows to copy/paste values
  (added `ignoreFocusOut: true` to all profile input boxes and quick picks)

## [0.1.0] - 2024-12-03

### Added

- Initial release of F5 Distributed Cloud Tools for VS Code
- Profile management with secure credential storage (VSCode SecretStorage)
- Support for API Token authentication
- Support for P12 certificate authentication (mTLS)
- Resource Explorer tree view with hierarchical navigation
- Browse namespaces, resource categories, and individual resources
- CRUD operations for F5 XC resources (Create, Read, Update, Delete)
- View and edit resource configurations in JSON format
- Compare local configurations with remote resources (diff view)
- JSON schema validation for resource configurations
- Support for 40+ F5 XC resource types:
  - Load Balancing: HTTP/TCP/UDP Load Balancers, Origin Pools, Health Checks,
    CDN Load Balancers
  - Security: App Firewalls, Service Policies, Rate Limiters, WAF Exclusion
    Policies
  - Bot Defense: Bot Defense Infrastructure, Protected Applications
  - API Protection: API Definitions, API Groups
  - Networking: Virtual Networks, Network Connectors, Network Firewalls, Network
    Policies
  - Sites: AWS VPC, AWS TGW, Azure VNET, GCP VPC, Voltstack, SecureMesh
  - DNS: DNS Zones, DNS Load Balancers, DNS LB Pools, DNS LB Health Checks
  - IAM: Namespaces, Users, Roles, API Credentials, Cloud Credentials
  - Configuration: Certificates, Trusted CA Lists
  - Observability: Alert Policies, Alert Receivers, Global Log Receivers,
    Synthetic Monitors
- Keyboard shortcuts for common operations
- Configurable settings (log level, default namespace, confirm delete,
  auto-refresh)
- Activity bar icon and sidebar views

### Security

- Credentials stored securely using VSCode SecretStorage API
- No credentials stored in settings.json or plaintext files
- P12 certificate password encrypted in secure storage

[Unreleased]:
  https://github.com/robinmordasiewicz/vscode-f5xc-tools/compare/v0.1.7...HEAD
[0.1.7]:
  https://github.com/robinmordasiewicz/vscode-f5xc-tools/compare/v0.1.6...v0.1.7
[0.1.6]:
  https://github.com/robinmordasiewicz/vscode-f5xc-tools/compare/v0.1.5...v0.1.6
[0.1.5]:
  https://github.com/robinmordasiewicz/vscode-f5xc-tools/compare/v0.1.4...v0.1.5
[0.1.4]:
  https://github.com/robinmordasiewicz/vscode-f5xc-tools/compare/v0.1.3...v0.1.4
[0.1.3]:
  https://github.com/robinmordasiewicz/vscode-f5xc-tools/compare/v0.1.2...v0.1.3
[0.1.2]:
  https://github.com/robinmordasiewicz/vscode-f5xc-tools/compare/v0.1.1...v0.1.2
[0.1.1]:
  https://github.com/robinmordasiewicz/vscode-f5xc-tools/compare/v0.1.0...v0.1.1
[0.1.0]:
  https://github.com/robinmordasiewicz/vscode-f5xc-tools/releases/tag/v0.1.0
