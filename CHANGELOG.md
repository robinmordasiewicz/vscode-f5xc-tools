# Changelog

All notable changes to the F5 Distributed Cloud Tools extension will be
documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Version numbers follow the upstream F5 XC API version as prefix.

## [2.0.7] - 2026-01-05

### Changed

- Refactor generators for domain-based API specs

### Fixed

- Add clean break validation for x-f5xc-cli-domain field
- Remove legacy x-ves-cli-domain fallback for clean break

## [2.0.2] - 2026-01-05

### Changed

- Migrate x-ves-\* namespace to x-f5xc-\* for v2.0.2 specs

## [1.0.91] - 2026-01-04

### Added

- Add fallback to profile credentials when env vars are invalid

### Fixed

- Prevent token/url mismatch when env vars override profile settings

## [1.0.84] - 2026-01-02

### Added

- Enhance tooltips with domain and operation metadata from upstream
- Add auth cache clearing and improved 401 debugging

### Changed

- Change profile config directory from xcsh to f5xc

### Fixed

- Trim whitespace from API tokens to prevent 401 auth errors

## [1.0.83] - 2026-01-02

### Added

- Add user-friendly error display in resources view

## [1.0.82] - 2026-01-01

### Added

- Implement XDG-compliant shared authentication system (#73)
- Add API spec freshness checking before builds

### Fixed

- Use 3-segment semver for VS Code Marketplace (#78)
- Fetch API specs at build time, remove from version control (#76)

## [1.0.77] - 2025-12-31

### Added

- Implement upstream API versioning scheme (#69)
- Add P2/P3 resource overrides for issues #51-#59 (#60)
- Add upstream sync workflow with repository_dispatch trigger
- P0 API metadata enhancements for improved UX and safety (#67)
- Use ui_category directly from upstream (single source of truth)

## [0.1.44] - 2025-12-31

### Added

- Support all 25 F5 XC API bases and add P1 resources

## [0.1.39] - 2025-12-17

### Fixed

- Correct quota key mappings to match F5 XC API responses
- Quota widget showing unavailable - add system namespace fallback

## [0.1.36] - 2025-12-17

### Added

- Add subscription dashboard and addon activation
- Enhanced describe provider functionality

## [0.1.31] - 2025-12-14

### Added

- Add delete namespace with RBAC permission checking
- Add description normalization during code generation
- Add POP details webview with geographic coordinates
- Rebrand voltstack to app stack

### Fixed

- Resolve npm deprecation warnings and update dependencies
- Upgrade Node.js from 20 to 22 in all workflows

## [0.1.30] - 2025-12-07

### Added

- Display maintenance details in internal webview
- Add cloud status monitoring feature
- Add diagram generation for HTTP load balancers

## [0.1.22] - 2025-12-05

### Added

- Add describe resource command with webview panel
- Auto-generate resource types from OpenAPI specs
- Make describe resource the default single-click action
- Add origin pool describe view and namespace filtering

### Fixed

- Correct namespace scope filtering for resource types
- Support extended API paths with service segments for DNS resources

## [0.1.13] - 2025-12-04

### Added

- Filter Resources command with fuzzy matching
- Find Resource command - searchable list across namespaces

## [0.1.0] - 2024-12-03

### Added

- Initial release of F5 Distributed Cloud Tools for VS Code
- Profile management with secure credential storage (VSCode SecretStorage)
- Support for API Token and P12 certificate authentication (mTLS)
- Resource Explorer tree view with hierarchical navigation
- CRUD operations for F5 XC resources
- JSON schema validation for resource configurations
- Support for 40+ F5 XC resource types
- Keyboard shortcuts for common operations

### Security

- Credentials stored securely using VSCode SecretStorage API
