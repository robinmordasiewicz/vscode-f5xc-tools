# F5 Distributed Cloud Tools for VS Code

A powerful Visual Studio Code extension for managing F5 Distributed Cloud
resources directly from your editor.

## Overview

F5 Distributed Cloud Tools provides a seamless interface to interact with F5 XC
resources, offering full CRUD operations, profile management, and real-time
monitoring capabilities.

### Key Features

- **236 Resource Types**: Comprehensive support for F5 XC resources across all
  domains
- **Profile Management**: Secure credential storage with API Token and P12
  certificate authentication
- **Tree View Explorer**: Hierarchical navigation (Namespace → Category →
  Resource Type → Resource)
- **CRUD Operations**: Create, read, update, and delete resources with JSON
  schema validation
- **Subscription Dashboard**: Monitor account usage, quotas, and add-on services
- **Cloud Status Monitoring**: Real-time F5 XC platform status and incident
  tracking

## Quick Links

<div class="features-grid">
  <a href="getting-started/installation/" class="feature-card">
    <div class="feature-card-header">
      <span class="feature-icon">📦</span>
      <h3>Installation</h3>
    </div>
    <p>Get started with F5 XC Tools in minutes</p>
  </a>

  <a href="getting-started/quick-start/" class="feature-card">
    <div class="feature-card-header">
      <span class="feature-icon">🚀</span>
      <h3>Quick Start</h3>
    </div>
    <p>Learn the basics and create your first profile</p>
  </a>

  <a href="user-guide/explorer/" class="feature-card">
    <div class="feature-card-header">
      <span class="feature-icon">🗂️</span>
      <h3>Resource Explorer</h3>
    </div>
    <p>Navigate and manage your F5 XC resources</p>
  </a>

  <a href="features/resource-types/" class="feature-card">
    <div class="feature-card-header">
      <span class="feature-icon">📋</span>
      <h3>Resource Types</h3>
    </div>
    <p>Browse all 236 supported resource types</p>
  </a>

  <a href="user-guide/subscription/" class="feature-card">
    <div class="feature-card-header">
      <span class="feature-icon">📊</span>
      <h3>Subscription Dashboard</h3>
    </div>
    <p>Monitor quotas and manage add-ons</p>
  </a>

  <a href="development/contributing/" class="feature-card">
    <div class="feature-card-header">
      <span class="feature-icon">🛠️</span>
      <h3>Contributing</h3>
    </div>
    <p>Help improve the extension</p>
  </a>
</div>

## Supported Resource Categories

| Category       | Resources                                     | Description                                 |
| -------------- | --------------------------------------------- | ------------------------------------------- |
| Load Balancing | HTTP/TCP/UDP LBs, Origin Pools, Health Checks | Application delivery and traffic management |
| Security       | App Firewalls, Service Policies, WAF          | Application security and policy enforcement |
| Networking     | Virtual Networks, Network Connectors          | Network infrastructure and connectivity     |
| Sites          | AWS VPC, Azure VNET, GCP VPC, Voltstack       | Multi-cloud site deployment                 |
| DNS            | DNS Zones, DNS Load Balancers                 | Global DNS management                       |
| IAM            | Namespaces, Users, Roles, API Credentials     | Identity and access management              |
| Observability  | Alert Policies, Log Receivers, Monitors       | Monitoring and alerting                     |
| Certificates   | Certificates, Trusted CA Lists                | SSL/TLS certificate management              |

## Requirements

- **VS Code**: 1.85.0 or higher
- **Node.js**: 22.x (for development)
- **F5 XC Account**: Valid credentials (API Token or P12 certificate)

## Security

- Credentials stored securely using VS Code SecretStorage API
- No credentials stored in plaintext files or settings.json
- P12 certificate passwords encrypted in secure storage
- Support for both API Token and mTLS authentication

## Support

- [GitHub Issues](https://github.com/robinmordasiewicz/vscode-f5xc-tools/issues)
- [F5 Distributed Cloud Documentation](https://docs.cloud.f5.com/)
- [Changelog](https://github.com/robinmordasiewicz/vscode-f5xc-tools/blob/main/CHANGELOG.md)

## License

Apache-2.0 - see
[LICENSE](https://github.com/robinmordasiewicz/vscode-f5xc-tools/blob/main/LICENSE)
for details.
