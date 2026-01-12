# Resource Types

F5 Distributed Cloud Tools supports 236 resource types across the F5 XC
platform, automatically generated from OpenAPI specifications and organized by
functional category.

## Overview

Resource types are automatically discovered and categorized based on:

- **OpenAPI Specifications**: Auto-generated from F5 XC API documentation
- **Domain Metadata**: Classified by functional domain (load balancing,
  security, networking, etc.)
- **API Paths**: Organized by API base path and service segment
- **Operation Support**: CRUD operations, custom actions, logs, and metrics

## Resource Categories

### Load Balancing

Core traffic management and distribution resources.

| Resource Type           | Description                                                               | Namespace Scope |
| ----------------------- | ------------------------------------------------------------------------- | --------------- |
| **HTTP Load Balancers** | Layer 7 load balancing with TLS termination, caching, and WAF integration | Any             |
| **TCP Load Balancers**  | Layer 4 TCP traffic distribution                                          | Any             |
| **Origin Pools**        | Backend server pools with health monitoring                               | Any             |
| **Health Checks**       | Active and passive health monitoring configurations                       | Any             |
| **Service Policies**    | Traffic routing and policy enforcement                                    | Any             |
| **Routes**              | HTTP routing rules and path-based forwarding                              | Any             |

### Security

Application and network security resources.

| Resource Type        | Description                               | Namespace Scope |
| -------------------- | ----------------------------------------- | --------------- |
| **App Firewalls**    | Web Application Firewall (WAF) policies   | Any             |
| **Service Policies** | Service-level security and access control | Any             |
| **Rate Limiters**    | Request rate limiting and throttling      | Any             |
| **WAF Exclusions**   | WAF rule exceptions and exclusions        | Any             |
| **IP Prefix Sets**   | IP address allow/block lists              | Any             |
| **Malicious Users**  | Bot and malicious user management         | Any             |
| **Network Policies** | Network-level firewall rules              | System          |
| **Security Events**  | Security event monitoring and alerts      | Any             |

### Networking

Network connectivity and infrastructure resources.

| Resource Type          | Description                                | Namespace Scope |
| ---------------------- | ------------------------------------------ | --------------- |
| **Virtual Networks**   | Software-defined network segments          | System          |
| **Network Connectors** | Inter-site and cloud connectivity          | System          |
| **Network Policies**   | Traffic filtering and network segmentation | System          |
| **Forward Proxies**    | Outbound proxy configurations              | Any             |
| **BGP**                | Border Gateway Protocol configurations     | System          |
| **Static Routes**      | Custom routing table entries               | System          |
| **Fleet**              | Site management and grouping               | System          |

### Sites

Physical and virtual site deployments across clouds and data centers.

| Resource Type        | Description                        | Namespace Scope |
| -------------------- | ---------------------------------- | --------------- |
| **AWS VPC Sites**    | F5 XC deployment in AWS VPCs       | System          |
| **Azure VNET Sites** | F5 XC deployment in Azure VNETs    | System          |
| **GCP VPC Sites**    | F5 XC deployment in GCP VPCs       | System          |
| **App Stack Sites**  | Kubernetes-based application sites | System          |
| **SecureMesh Sites** | Service mesh deployment sites      | System          |
| **VM Sites**         | Virtual machine-based sites        | System          |
| **Physical Sites**   | Bare metal CE deployments          | System          |

### Cloud Connect

Cloud provider integrations and multi-cloud networking.

| Resource Type         | Description                            | Namespace Scope |
| --------------------- | -------------------------------------- | --------------- |
| **AWS TGW Sites**     | AWS Transit Gateway integrations       | System          |
| **Azure VNET Sites**  | Azure Virtual Network integrations     | System          |
| **GCP VPC Sites**     | GCP Virtual Private Cloud integrations | System          |
| **Cloud Credentials** | Cloud provider API credentials         | System          |
| **Mesh Groups**       | Multi-site mesh connectivity           | System          |

### DNS

DNS management and global server load balancing.

| Resource Type          | Description                  | Namespace Scope |
| ---------------------- | ---------------------------- | --------------- |
| **DNS Zones**          | DNS zone management          | Any             |
| **DNS Load Balancers** | Global server load balancing | Any             |
| **DNS LB Pools**       | Origin pools for GSLB        | Any             |
| **DNSSEC**             | DNS security extensions      | Any             |

### Observability

Monitoring, logging, and analytics resources.

| Resource Type         | Description                                            | Namespace Scope |
| --------------------- | ------------------------------------------------------ | --------------- |
| **Alert Policies**    | Alert rules and notification policies                  | Any             |
| **Alert Receivers**   | Alert notification endpoints (email, Slack, PagerDuty) | System          |
| **Log Receivers**     | External log forwarding (Splunk, Datadog, S3)          | System          |
| **Metrics Receivers** | Metrics export endpoints                               | System          |
| **Dashboards**        | Custom monitoring dashboards                           | Any             |
| **Reports**           | Scheduled and on-demand reports                        | Any             |

### Identity & Access Management (IAM)

User management and access control.

| Resource Type           | Description                           | Namespace Scope |
| ----------------------- | ------------------------------------- | --------------- |
| **Namespaces**          | Logical resource isolation boundaries | System          |
| **Users**               | User account management               | System          |
| **Roles**               | Role-based access control (RBAC)      | System          |
| **API Credentials**     | API tokens and certificates           | System          |
| **Service Credentials** | Service account credentials           | System          |
| **Auth Servers**        | External authentication (SAML, OIDC)  | System          |

### Bot Defense

Bot detection and mitigation.

| Resource Type            | Description                        | Namespace Scope |
| ------------------------ | ---------------------------------- | --------------- |
| **Bot Defense Policies** | Bot detection and mitigation rules | Any             |
| **Mobile SDKs**          | Mobile application bot protection  | Any             |
| **Protected Endpoints**  | Endpoint-specific bot protection   | Any             |

### API Protection

API security and management.

| Resource Type         | Description                          | Namespace Scope |
| --------------------- | ------------------------------------ | --------------- |
| **API Definitions**   | OpenAPI/Swagger specification import | Any             |
| **API Discovery**     | Automatic API endpoint discovery     | Any             |
| **API Endpoints**     | Discovered API endpoint inventory    | Any             |
| **API Rate Limiting** | API-specific rate limiting           | Any             |

### Data Protection

Data loss prevention and sensitive data protection.

| Resource Type    | Description                         | Namespace Scope |
| ---------------- | ----------------------------------- | --------------- |
| **Data Guards**  | Sensitive data masking and blocking | Any             |
| **DLP Policies** | Data loss prevention rules          | Any             |

### Edge Stack

Edge computing and application deployment.

| Resource Type          | Description                       | Namespace Scope |
| ---------------------- | --------------------------------- | --------------- |
| **Virtual Kubernetes** | Managed Kubernetes clusters       | Any             |
| **Workloads**          | Application workload definitions  | Any             |
| **Storage Classes**    | Persistent storage configurations | Any             |

### Service Mesh

Service-to-service communication and observability.

| Resource Type        | Description                      | Namespace Scope |
| -------------------- | -------------------------------- | --------------- |
| **Service Policies** | Service mesh traffic policies    | Any             |
| **Virtual Sites**    | Logical grouping of services     | Any             |
| **Discovery**        | Service discovery configurations | Any             |

### Multi-Cloud

Multi-cloud infrastructure management.

| Resource Type        | Description                   | Namespace Scope |
| -------------------- | ----------------------------- | --------------- |
| **Cloud Sites**      | Unified cloud site management | System          |
| **Terraform States** | Terraform state management    | System          |
| **Fleet**            | Multi-site fleet management   | System          |

### Configuration

Platform configuration and management.

| Resource Type       | Description                   | Namespace Scope |
| ------------------- | ----------------------------- | --------------- |
| **Global Settings** | Tenant-wide configuration     | System          |
| **Labels**          | Resource labeling and tagging | Any             |
| **Annotations**     | Resource metadata annotations | Any             |

### BIG-IP Connector

F5 BIG-IP integration resources.

| Resource Type       | Description                            | Namespace Scope |
| ------------------- | -------------------------------------- | --------------- |
| **BIG-IP Clusters** | BIG-IP cluster management              | System          |
| **BIG-IP Devices**  | Individual BIG-IP device configuration | System          |
| **BIG-IP Pools**    | BIG-IP server pool integration         | Any             |

### Infrastructure Protection

DDoS protection and infrastructure security.

| Resource Type       | Description                              | Namespace Scope |
| ------------------- | ---------------------------------------- | --------------- |
| **DDoS Protection** | Distributed denial-of-service mitigation | Any             |
| **L3-L4 Firewall**  | Network layer firewall rules             | System          |

### NGINX One

NGINX management and configuration.

| Resource Type       | Description                    | Namespace Scope |
| ------------------- | ------------------------------ | --------------- |
| **NGINX Instances** | NGINX server management        | System          |
| **NGINX Configs**   | NGINX configuration management | Any             |

### Client-Side Defense

Browser and client-side security.

| Resource Type           | Description                                 | Namespace Scope |
| ----------------------- | ------------------------------------------- | --------------- |
| **Client-Side Defense** | JavaScript malware and supply chain attacks | Any             |
| **Malicious Scripts**   | Detected malicious script inventory         | Any             |

### Kubernetes

Kubernetes cluster management and integration.

| Resource Type          | Description                       | Namespace Scope |
| ---------------------- | --------------------------------- | --------------- |
| **Managed Kubernetes** | F5 XC managed Kubernetes clusters | System          |
| **K8s Connectors**     | Kubernetes cluster integration    | System          |

### Discovery

Asset and service discovery.

| Resource Type                | Description                        | Namespace Scope |
| ---------------------------- | ---------------------------------- | --------------- |
| **Discovery Configurations** | Automatic resource discovery rules | System          |
| **Discovered Services**      | Automatically discovered services  | System          |

### AI & Automation

AI-powered automation and analytics.

| Resource Type       | Description                        | Namespace Scope |
| ------------------- | ---------------------------------- | --------------- |
| **AI Models**       | AI model deployment and management | System          |
| **Gen AI Services** | Generative AI service integration  | Any             |

### Routing

Advanced routing and traffic steering.

| Resource Type    | Description                     | Namespace Scope |
| ---------------- | ------------------------------- | --------------- |
| **Route Tables** | Custom routing tables           | System          |
| **BGP Peers**    | Border Gateway Protocol peering | System          |

## API Base Paths

Resources are organized across different F5 XC API bases:

| API Base              | Description                  | Example Path                                     |
| --------------------- | ---------------------------- | ------------------------------------------------ |
| **config**            | Configuration API (primary)  | `/api/config/namespaces/{ns}/http_loadbalancers` |
| **web**               | Web console API              | `/api/web/namespaces`                            |
| **gen-ai**            | Generative AI services       | `/api/gen-ai/...`                                |
| **data**              | Data and analytics           | `/api/data/...`                                  |
| **observability**     | Monitoring and logs          | `/api/observability/...`                         |
| **scim**              | User provisioning (SCIM 2.0) | `/api/scim/v2/Users`                             |
| **secret_management** | Secrets and credentials      | `/api/secret_management/...`                     |
| **terraform**         | Terraform state management   | `/api/terraform/...`                             |

## Namespace Scopes

Resources operate within different namespace scopes:

### Any Namespace

Most application-level resources can be created in any user namespace (shared,
default, or custom):

- HTTP/TCP Load Balancers
- Origin Pools
- App Firewalls
- Service Policies
- DNS Zones

### System Namespace

Infrastructure resources are restricted to the system namespace:

- Sites (AWS VPC, Azure VNET, GCP VPC)
- Virtual Networks
- Network Connectors
- Users and Roles
- Cloud Credentials

### Shared Namespace

Some resources are restricted to the shared namespace for tenant-wide sharing:

- Alert Receivers
- Log Receivers
- Certificates (when globally shared)

## Resource Operations

### CRUD Operations

All resources support standard CRUD operations:

| Operation  | HTTP Method | Description                     |
| ---------- | ----------- | ------------------------------- |
| **List**   | GET or POST | List all resources in namespace |
| **Get**    | GET         | Get specific resource by name   |
| **Create** | POST        | Create new resource             |
| **Update** | PUT         | Replace resource configuration  |
| **Delete** | DELETE      | Remove resource                 |

### Custom Operations

Some resources support additional custom operations:

- **Apply**: Apply configuration changes (HTTP PATCH)
- **Diff**: Compare local vs remote configuration
- **Clone**: Duplicate resource with modifications
- **Export**: Export resource configuration
- **Import**: Import resource from file

### Supported Features

| Feature        | Description                         | Availability                  |
| -------------- | ----------------------------------- | ----------------------------- |
| **Logs**       | Access resource-specific logs       | Load Balancers, App Firewalls |
| **Metrics**    | View resource metrics and analytics | Load Balancers, Origin Pools  |
| **Events**     | Audit trail and security events     | All resources                 |
| **Validation** | JSON schema validation              | All resources                 |

## Domain Classification

Resources are classified by functional domain:

| Domain             | Resource Count | Examples                              |
| ------------------ | -------------- | ------------------------------------- |
| **Load Balancing** | 15+            | HTTP LB, TCP LB, Origin Pools         |
| **Security**       | 25+            | WAF, Rate Limiter, Service Policy     |
| **Networking**     | 20+            | Virtual Network, Network Connector    |
| **Sites**          | 12+            | AWS VPC, Azure VNET, GCP VPC          |
| **Observability**  | 18+            | Alerts, Logs, Metrics, Dashboards     |
| **IAM**            | 10+            | Users, Roles, API Credentials         |
| **DNS**            | 8+             | DNS Zones, DNS LB, DNSSEC             |
| **Other**          | 120+           | AI, Bot Defense, API Protection, etc. |

## Preview and Beta Resources

Some resources are in preview or beta status:

!!! warning "Preview Resources" Resources marked as "preview" may have:

    - Limited availability (tier requirements)
    - Incomplete documentation
    - API changes without notice
    - Restricted access (early access program)

Check resource tier requirements:

- **Basic**: Available in all tiers
- **Advanced**: Requires Advanced tier subscription
- **Enterprise**: Requires Enterprise tier subscription

## Auto-Generated Types

Resource types are automatically generated from F5 XC OpenAPI specifications:

1. **Specification Download**: Latest API specs fetched from F5 XC
2. **Schema Parsing**: OpenAPI schemas parsed for resource definitions
3. **Type Generation**: TypeScript interfaces and metadata generated
4. **Category Mapping**: Resources mapped to UI categories
5. **Operation Metadata**: CRUD operations, prerequisites, and warnings
   extracted

This ensures the extension stays synchronized with the latest F5 XC API
releases.

## Resource Type Metadata

Each resource type includes rich metadata:

```typescript
{
  apiPath: "http_loadbalancers",
  displayName: "HTTP Load Balancers",
  category: "Load Balancing",
  description: "Layer 7 load balancing with TLS termination",
  domain: "load_balancing",
  apiBase: "config",
  namespaceScope: "any",
  supportsCustomOps: true,
  supportsLogs: true,
  supportsMetrics: true,
  schemaFile: "ves.io.schema.http_loadbalancer.json",
  operationMetadata: {
    create: {
      dangerLevel: "medium",
      sideEffects: ["Creates public endpoint", "Incurs traffic costs"],
      prerequisites: ["Origin pool must exist"],
      commonErrors: [...]
    }
  }
}
```

## Finding Resource Types

### In VS Code

1. Open the Resources tree view
2. Expand a namespace
3. Resource types are grouped by category
4. Click a resource type to see all instances

### Programmatically

```typescript
import { RESOURCE_TYPES, getAllResourceTypeKeys } from './api/resourceTypes';

// Get all resource type keys
const allTypes = getAllResourceTypeKeys();
console.log(`Total resource types: ${allTypes.length}`);

// Get specific resource type info
const lbInfo = RESOURCE_TYPES.http_loadbalancer;
console.log(lbInfo.displayName); // "HTTP Load Balancers"
console.log(lbInfo.category); // "Load Balancing"
```

## Next Steps

- [Create and manage resources](../user-guide/crud-operations.md)
- [Browse resources in the explorer](../user-guide/explorer.md)
- [Configure authentication](../getting-started/authentication.md)
