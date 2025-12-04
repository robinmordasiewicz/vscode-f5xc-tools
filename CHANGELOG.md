# Changelog

All notable changes to the F5 Distributed Cloud Tools extension will be
documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
  https://github.com/robinmordasiewicz/vscode-f5xc-tools/compare/v0.1.2...HEAD
[0.1.2]:
  https://github.com/robinmordasiewicz/vscode-f5xc-tools/compare/v0.1.1...v0.1.2
[0.1.1]:
  https://github.com/robinmordasiewicz/vscode-f5xc-tools/compare/v0.1.0...v0.1.1
[0.1.0]:
  https://github.com/robinmordasiewicz/vscode-f5xc-tools/releases/tag/v0.1.0
