// Copyright (c) 2026 Robin Mordasiewicz. MIT License.

import * as vscode from 'vscode';
import { ProfileManager } from '../config/profiles';
import { getLogger } from '../utils/logger';

const logger = getLogger();

/**
 * HTTP Load Balancer configuration structure
 */
interface HttpLoadBalancerConfig {
  metadata?: {
    name?: string;
  };
  spec?: {
    domains?: string[];
    cert_state?: string;
    downstream_tls_certificate_expiration_timestamps?: string[];
    app_firewall?: {
      name?: string;
      namespace?: string;
    };
    active_service_policies?: {
      policies?: Array<{
        name?: string;
        namespace?: string;
      }>;
    };
    service_policies_from_namespace?: Record<string, unknown>;
    no_service_policies?: Record<string, unknown>;
    default_route_pools?: Array<{
      pool?: {
        name?: string;
        namespace?: string;
      };
    }>;
    routes?: Array<{
      simple_route?: {
        path?: {
          prefix?: string;
          regex?: string;
        };
        headers?: Array<{
          name?: string;
          regex?: string;
        }>;
        origin_pools?: Array<{
          pool?: {
            name?: string;
            namespace?: string;
          };
        }>;
        advanced_options?: {
          app_firewall?: {
            name?: string;
            namespace?: string;
          };
          inherited_waf?: Record<string, unknown>;
        };
      };
      redirect_route?: {
        path?: {
          prefix?: string;
        };
        route_redirect?: {
          host_redirect?: string;
          path_redirect?: string;
        };
      };
    }>;
    advertise_on_public_default_vip?: Record<string, unknown>;
    advertise_on_public?: Record<string, unknown>;
    advertise_custom?: {
      advertise_where?: Array<{
        site?: {
          network?: string;
          site?: {
            name?: string;
            namespace?: string;
          };
          ip?: string;
        };
        virtual_site?: {
          network?: string;
          virtual_site?: {
            name?: string;
            namespace?: string;
          };
        };
        virtual_site_with_vip?: {
          network?: string;
          virtual_site?: {
            name?: string;
            namespace?: string;
          };
          ip?: string;
        };
        vk8s_service?: {
          site?: {
            name?: string;
            namespace?: string;
          };
        };
      }>;
    };
    api_protection_rules?: Record<string, unknown>;
    bot_defense?: Record<string, unknown>;
    disable_bot_defense?: Record<string, unknown>;
    enable_malicious_user_detection?: Record<string, unknown>;
    disable_waf?: Record<string, unknown>;
  };
}

/**
 * Origin Pool configuration structure
 */
interface OriginPoolConfig {
  metadata?: {
    name?: string;
  };
  spec?: {
    origin_servers?: Array<{
      private_ip?: {
        ip?: string;
        site_locator?: {
          site?: {
            name?: string;
            namespace?: string;
          };
        };
      };
      public_ip?: {
        ip?: string;
      };
      public_name?: {
        dns_name?: string;
      };
      private_name?: {
        dns_name?: string;
        site_locator?: {
          site?: {
            name?: string;
            namespace?: string;
          };
        };
      };
      k8s_service?: {
        service_name?: string;
        site_locator?: {
          site?: {
            name?: string;
            namespace?: string;
          };
        };
      };
      labels?: Record<string, string>;
    }>;
    port?: number;
    healthcheck?: Array<{
      name?: string;
      namespace?: string;
    }>;
  };
}

/**
 * Origin server display info
 */
interface OriginServerInfo {
  type: string;
  value: string;
  site?: string;
}

/**
 * WebView provider for displaying F5 XC HTTP Load Balancer diagrams.
 * Generates Mermaid flowcharts showing the complete request path.
 */
export class F5XCDiagramProvider {
  private panel: vscode.WebviewPanel | undefined;

  constructor(private readonly profileManager: ProfileManager) {}

  /**
   * Generate a nonce for CSP
   */
  private getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  /**
   * Show the diagram panel for an HTTP Load Balancer
   */
  async showDiagram(profileName: string, namespace: string, resourceName: string): Promise<void> {
    try {
      logger.debug(`Generating diagram for: ${resourceName}`);

      const client = await this.profileManager.getClient(profileName);

      // Fetch HTTP Load Balancer configuration
      const lbConfig = (await client.get(
        namespace,
        'http_loadbalancers',
        resourceName,
      )) as HttpLoadBalancerConfig;

      // Collect all origin pool references
      const poolRefs = this.collectOriginPoolRefs(lbConfig, namespace);

      // Fetch all origin pool configurations
      const originPools = new Map<string, OriginPoolConfig>();
      for (const ref of poolRefs) {
        try {
          const poolConfig = (await client.get(
            ref.namespace,
            'origin_pools',
            ref.name,
          )) as OriginPoolConfig;
          originPools.set(`${ref.namespace}/${ref.name}`, poolConfig);
        } catch (error) {
          const errMessage = error instanceof Error ? error.message : String(error);
          logger.warn(`Failed to fetch origin pool ${ref.namespace}/${ref.name}: ${errMessage}`);
          // Store a placeholder for failed fetches
          originPools.set(`${ref.namespace}/${ref.name}`, {
            metadata: { name: ref.name },
            spec: { origin_servers: [] },
          });
        }
      }

      // Generate Mermaid diagram
      const mermaidCode = this.generateMermaidDiagram(lbConfig, originPools, namespace);

      if (this.panel) {
        this.panel.reveal(vscode.ViewColumn.Beside);
      } else {
        this.panel = vscode.window.createWebviewPanel(
          'f5xcDiagram',
          `Diagram: ${resourceName}`,
          vscode.ViewColumn.Beside,
          {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [],
          },
        );

        this.panel.onDidDispose(() => {
          this.panel = undefined;
        });

        // Set up message handler for export/copy actions
        this.panel.webview.onDidReceiveMessage(
          async (message: { command: string; data?: string }) => {
            switch (message.command) {
              case 'copyMermaid':
                await vscode.env.clipboard.writeText(mermaidCode);
                void vscode.window.showInformationMessage('Mermaid code copied to clipboard');
                break;
              case 'exportSvg':
                if (message.data) {
                  await this.exportDiagram(message.data, 'svg', resourceName);
                }
                break;
              case 'exportPng':
                if (message.data) {
                  await this.exportDiagram(message.data, 'png', resourceName);
                }
                break;
            }
          },
        );
      }

      this.panel.title = `Diagram: ${resourceName}`;
      this.panel.webview.html = this.getWebviewContent(mermaidCode, resourceName);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to generate diagram: ${message}`);
      void vscode.window.showErrorMessage(`Failed to generate diagram: ${message}`);
    }
  }

  /**
   * Export diagram to file
   */
  private async exportDiagram(
    data: string,
    format: 'svg' | 'png',
    resourceName: string,
  ): Promise<void> {
    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(`${resourceName}-diagram.${format}`),
      filters: {
        [format.toUpperCase()]: [format],
      },
    });

    if (uri) {
      try {
        if (format === 'svg') {
          await vscode.workspace.fs.writeFile(uri, Buffer.from(data, 'utf8'));
        } else {
          // PNG data comes as base64
          const pngData = data.replace(/^data:image\/png;base64,/, '');
          await vscode.workspace.fs.writeFile(uri, Buffer.from(pngData, 'base64'));
        }
        void vscode.window.showInformationMessage(`Diagram exported to ${uri.fsPath}`);
      } catch (error) {
        const errMessage = error instanceof Error ? error.message : String(error);
        void vscode.window.showErrorMessage(`Failed to export diagram: ${errMessage}`);
      }
    }
  }

  /**
   * Collect all origin pool references from the load balancer config
   */
  private collectOriginPoolRefs(
    lbConfig: HttpLoadBalancerConfig,
    defaultNamespace: string,
  ): Array<{ name: string; namespace: string }> {
    const refs: Array<{ name: string; namespace: string }> = [];
    const seen = new Set<string>();

    const addRef = (pool?: { name?: string; namespace?: string }) => {
      if (pool?.name) {
        const ns = pool.namespace || defaultNamespace;
        const key = `${ns}/${pool.name}`;
        if (!seen.has(key)) {
          seen.add(key);
          refs.push({ name: pool.name, namespace: ns });
        }
      }
    };

    // Default route pools
    lbConfig.spec?.default_route_pools?.forEach((p) => addRef(p.pool));

    // Route-specific pools
    lbConfig.spec?.routes?.forEach((route) => {
      route.simple_route?.origin_pools?.forEach((p) => addRef(p.pool));
    });

    return refs;
  }

  /**
   * Generate Mermaid diagram from HTTP Load Balancer configuration
   */
  private generateMermaidDiagram(
    lbConfig: HttpLoadBalancerConfig,
    originPools: Map<string, OriginPoolConfig>,
    defaultNamespace: string,
  ): string {
    const lines: string[] = [];
    const lbName = lbConfig.metadata?.name || 'LoadBalancer';
    const spec = lbConfig.spec;

    // Track nodes for unique IDs
    let nodeCount = 0;
    const poolToNodes = new Map<string, string[]>();

    // Determine load balancer type
    let lbType = 'Load Balancer';
    const isPrivate =
      spec?.advertise_custom?.advertise_where && spec.advertise_custom.advertise_where.length > 0;
    if (isPrivate) {
      lbType = 'Private Load Balancer';
    } else if (spec?.advertise_on_public_default_vip || spec?.advertise_on_public) {
      lbType = 'Public Load Balancer';
    }

    // Determine WAF status
    let wafName = spec?.app_firewall?.name || '';
    let wafClass = 'certValid';
    if (!wafName || spec?.disable_waf) {
      wafName = 'WAF Not Configured';
      wafClass = lbType === 'Public Load Balancer' ? 'noWaf' : 'certError';
    }

    // Start Mermaid diagram
    lines.push('---');
    lines.push(`title: ${lbName} Service Flow`);
    lines.push('---');
    lines.push('graph TD;');
    lines.push('');

    // Style definitions
    lines.push('    classDef certValid stroke:#01ba44,stroke-width:2px;');
    lines.push('    classDef certWarning stroke:#DAA520,stroke-width:2px;');
    lines.push('    classDef certError stroke:#B22222,stroke-width:2px;');
    lines.push('    classDef noWaf fill:#FF5733,stroke:#B22222,stroke-width:2px;');
    lines.push('');

    // User to Load Balancer
    lines.push('    User([User]) --> LoadBalancer;');
    lines.push(`    LoadBalancer["<b>${this.escapeLabel(lbName)}</b><br>${lbType}"];`);
    lines.push('');

    // Process Domains with Certificate Info
    const domains = spec?.domains || [];
    const certState = spec?.cert_state || '';
    const certExpiration = spec?.downstream_tls_certificate_expiration_timestamps?.[0] || '';

    let certStatus = 'Unknown';
    let certClass = '';
    if (certState === 'CertificateValid') {
      certStatus = 'Valid';
      certClass = 'certValid';
    } else if (certState === 'CertificateExpiringSoon') {
      certStatus = 'Expiring Soon';
      certClass = 'certWarning';
    } else if (certState === 'CertificateExpired') {
      certStatus = 'Expired';
      certClass = 'certError';
    } else if (certState) {
      certStatus = certState.replace('Certificate', '');
      certClass = 'certError';
    }

    const formattedExpiry = certExpiration ? this.formatDateShort(certExpiration) : 'N/A';

    for (const domain of domains) {
      const domainId = this.sanitizeId(domain);
      const domainLabel = `${domain}<br>Cert: ${certStatus}<br>Exp: ${formattedExpiry}`;
      lines.push(`    LoadBalancer -->|SNI| domain_${domainId}["${domainLabel}"];`);
      if (certClass) {
        lines.push(`    class domain_${domainId} ${certClass};`);
      }
    }
    lines.push('');

    // Handle Private LB advertise targets
    if (isPrivate && spec?.advertise_custom?.advertise_where) {
      lines.push('    subgraph AdvertiseTargets ["<b>Advertised To</b>"]');
      lines.push('        direction LR');

      spec.advertise_custom.advertise_where.forEach((adv, i) => {
        const nodeId = `adv_target_${i}`;
        let label = '';

        if (adv.site) {
          label = `Site: ${adv.site.site?.name || 'Unknown'}<br>Network: ${adv.site.network || 'N/A'}`;
          if (adv.site.ip) {
            label += `<br>IP: ${adv.site.ip}`;
          }
        } else if (adv.virtual_site) {
          label = `Virtual Site: ${adv.virtual_site.virtual_site?.name || 'Unknown'}<br>Network: ${adv.virtual_site.network || 'N/A'}`;
        } else if (adv.virtual_site_with_vip) {
          label = `Virtual Site: ${adv.virtual_site_with_vip.virtual_site?.name || 'Unknown'}<br>Network: ${adv.virtual_site_with_vip.network || 'N/A'}`;
          if (adv.virtual_site_with_vip.ip) {
            label += `<br>IP: ${adv.virtual_site_with_vip.ip}`;
          }
        } else if (adv.vk8s_service) {
          label = `vK8s Service on<br>${adv.vk8s_service.site?.name || 'Unknown'}`;
        } else {
          label = 'Unknown Target';
        }

        lines.push(`        ${nodeId}["${label}"];`);
      });

      lines.push('    end');
      lines.push('');

      // Connect domains to advertise targets and then to service policies
      for (const domain of domains) {
        const domainId = this.sanitizeId(domain);
        spec.advertise_custom.advertise_where.forEach((_, i) => {
          lines.push(`    domain_${domainId} --> adv_target_${i};`);
        });
      }
      spec.advertise_custom.advertise_where.forEach((_, i) => {
        lines.push(`    adv_target_${i} --> ServicePolicies;`);
      });
    } else {
      // Public LB - domains connect directly to service policies
      for (const domain of domains) {
        const domainId = this.sanitizeId(domain);
        lines.push(`    domain_${domainId} --> ServicePolicies;`);
      }
    }
    lines.push('');

    // Service Policies subgraph
    lines.push('    subgraph ServicePolicies ["<b>Common Security Controls</b>"]');
    lines.push('        direction LR');

    const policies = spec?.active_service_policies?.policies || [];
    if (policies.length > 0) {
      for (const policy of policies) {
        const policyId = this.sanitizeId(policy.name || 'policy');
        lines.push(`        sp_${policyId}["${policy.name || 'Policy'}"];`);
      }
    } else if (spec?.service_policies_from_namespace) {
      lines.push('        sp_ns["Apply Namespace Service Policies"];');
    } else {
      lines.push('        sp_none["No Service Policies Defined"];');
    }

    // Malicious User Detection
    if (spec?.enable_malicious_user_detection) {
      lines.push('        mud["Malicious User Detection"];');
    }

    lines.push('    end');
    lines.push('');

    // API Protection
    let lastSecurityNode = 'ServicePolicies';
    if (spec?.api_protection_rules) {
      lines.push('    api_protection["<b>API Protection Enabled</b>"];');
      lines.push(`    ${lastSecurityNode} --> api_protection;`);
      lastSecurityNode = 'api_protection';
    }

    // Bot Defense
    if (spec?.bot_defense) {
      lines.push('    bot_defense["<b>Bot Defense Enabled</b>"];');
      lines.push(`    ${lastSecurityNode} --> bot_defense;`);
      lastSecurityNode = 'bot_defense';
    } else if (spec?.disable_bot_defense) {
      lines.push('    bot_defense["<b>Bot Defense Disabled</b>"];');
      lines.push(`    ${lastSecurityNode} --> bot_defense;`);
      lastSecurityNode = 'bot_defense';
    }

    // WAF
    const wafId = this.sanitizeId(wafName);
    lines.push(`    waf_${wafId}["WAF: ${this.escapeLabel(wafName)}"];`);
    lines.push(`    ${lastSecurityNode} -->|Process WAF| waf_${wafId};`);
    lines.push(`    class waf_${wafId} ${wafClass};`);
    lines.push(`    waf_${wafId} --> Routes;`);
    lines.push('');

    // Routes
    lines.push('    Routes["<b>Routes</b>"];');
    lines.push('');

    // Default Route
    const defaultPools = spec?.default_route_pools || [];
    if (defaultPools.length > 0) {
      lines.push('    DefaultRoute["<b>Default Route</b>"];');
      lines.push('    Routes --> DefaultRoute;');

      for (const poolRef of defaultPools) {
        const poolName = poolRef.pool?.name || 'unknown';
        const poolNs = poolRef.pool?.namespace || defaultNamespace;
        const poolKey = `${poolNs}/${poolName}`;
        const poolId = this.sanitizeId(poolName);
        const poolConfig = originPools.get(poolKey);

        lines.push(`    pool_${poolId}["<b>Pool</b><br>${this.escapeLabel(poolName)}"];`);
        lines.push(`    DefaultRoute --> pool_${poolId};`);

        // Add origin servers
        const originNodes = this.addOriginServers(poolConfig, poolId, nodeCount, lines);
        nodeCount += originNodes.length;
        poolToNodes.set(poolKey, originNodes);
      }
    }
    lines.push('');

    // Custom Routes
    const routes = spec?.routes || [];
    routes.forEach((route, i) => {
      if (route.simple_route) {
        const sr = route.simple_route;
        const matchConditions: string[] = ['<b>Route</b>'];

        if (sr.path?.prefix) {
          matchConditions.push(`Path: ${sr.path.prefix}`);
        } else if (sr.path?.regex) {
          matchConditions.push(`Path Regex: ${sr.path.regex}`);
        }

        sr.headers?.forEach((header) => {
          if (header.regex) {
            matchConditions.push(`Header: ${header.name} ~ ${header.regex}`);
          } else {
            matchConditions.push(`Header: ${header.name}`);
          }
        });

        const routeId = `route_${i}`;
        const routeLabel = matchConditions.join('<br>');
        lines.push(`    ${routeId}["${routeLabel}"];`);
        lines.push(`    Routes --> ${routeId};`);

        // Route-specific WAF
        const routeWaf = sr.advanced_options?.app_firewall?.name;
        let routeLastNode = routeId;
        if (routeWaf) {
          const routeWafId = this.sanitizeId(routeWaf);
          lines.push(`    waf_route_${routeWafId}["WAF: ${this.escapeLabel(routeWaf)}"];`);
          lines.push(`    ${routeId} --> waf_route_${routeWafId};`);
          routeLastNode = `waf_route_${routeWafId}`;
        }

        // Route origin pools
        sr.origin_pools?.forEach((poolRef) => {
          const poolName = poolRef.pool?.name || 'unknown';
          const poolNs = poolRef.pool?.namespace || defaultNamespace;
          const poolKey = `${poolNs}/${poolName}`;
          const poolId = this.sanitizeId(poolName);
          const poolConfig = originPools.get(poolKey);

          // Check if pool node already exists
          if (!poolToNodes.has(poolKey)) {
            lines.push(`    pool_${poolId}["<b>Pool</b><br>${this.escapeLabel(poolName)}"];`);
            const originNodes = this.addOriginServers(poolConfig, poolId, nodeCount, lines);
            nodeCount += originNodes.length;
            poolToNodes.set(poolKey, originNodes);
          }

          lines.push(`    ${routeLastNode} --> pool_${poolId};`);
        });

        lines.push('');
      } else if (route.redirect_route) {
        const rr = route.redirect_route;
        const routeId = `redirect_${i}`;
        const routeLabel = `<b>Redirect</b><br>Path: ${rr.path?.prefix || '/'}<br>To: ${rr.route_redirect?.host_redirect || ''}${rr.route_redirect?.path_redirect || ''}`;
        lines.push(`    ${routeId}["${routeLabel}"];`);
        lines.push(`    Routes --> ${routeId};`);
        lines.push('');
      }
    });

    return lines.join('\n');
  }

  /**
   * Add origin server nodes to the diagram
   */
  private addOriginServers(
    poolConfig: OriginPoolConfig | undefined,
    poolId: string,
    startNodeCount: number,
    lines: string[],
  ): string[] {
    const nodeIds: string[] = [];
    const servers = poolConfig?.spec?.origin_servers || [];

    if (servers.length === 0) {
      const nodeId = `node_${startNodeCount}`;
      lines.push(`    ${nodeId}["No origins configured"];`);
      lines.push(`    pool_${poolId} --> ${nodeId};`);
      nodeIds.push(nodeId);
      return nodeIds;
    }

    servers.forEach((server, idx) => {
      const info = this.getOriginServerInfo(server);
      const nodeId = `node_${startNodeCount + idx}`;
      let label = `${info.type}: ${this.escapeLabel(info.value)}`;
      if (info.site) {
        label += `<br>Site: ${info.site}`;
      }
      lines.push(`    ${nodeId}["${label}"];`);
      lines.push(`    pool_${poolId} --> ${nodeId};`);
      nodeIds.push(nodeId);
    });

    return nodeIds;
  }

  /**
   * Extract origin server type and value
   */
  private getOriginServerInfo(
    server: NonNullable<NonNullable<OriginPoolConfig['spec']>['origin_servers']>[number],
  ): OriginServerInfo {
    if (server.private_ip?.ip) {
      return {
        type: 'Private IP',
        value: server.private_ip.ip,
        site: server.private_ip.site_locator?.site?.name,
      };
    }
    if (server.public_ip?.ip) {
      return {
        type: 'Public IP',
        value: server.public_ip.ip,
      };
    }
    if (server.public_name?.dns_name) {
      return {
        type: 'Public DNS',
        value: server.public_name.dns_name,
      };
    }
    if (server.private_name?.dns_name) {
      return {
        type: 'Private DNS',
        value: server.private_name.dns_name,
        site: server.private_name.site_locator?.site?.name,
      };
    }
    if (server.k8s_service?.service_name) {
      return {
        type: 'K8s Service',
        value: server.k8s_service.service_name,
        site: server.k8s_service.site_locator?.site?.name,
      };
    }
    return {
      type: 'Unknown',
      value: 'Unknown',
    };
  }

  /**
   * Format ISO date to short format
   */
  private formatDateShort(isoString: string): string {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return isoString;
    }
  }

  /**
   * Sanitize string for use as Mermaid node ID
   */
  private sanitizeId(str: string): string {
    return str.replace(/[^a-zA-Z0-9]/g, '_');
  }

  /**
   * Escape special characters for Mermaid labels
   */
  private escapeLabel(str: string): string {
    // Escape quotes and angle brackets
    return str.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /**
   * Generate HTML content for the webview
   */
  private getWebviewContent(mermaidCode: string, resourceName: string): string {
    const nonce = this.getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}' https://cdn.jsdelivr.net; img-src data:;">
  <title>Diagram: ${this.escapeHtml(resourceName)}</title>
  <style>
    ${this.getStyles()}
  </style>
</head>
<body>
  <div class="toolbar">
    <div class="toolbar-left">
      <span class="title">HTTP Load Balancer Diagram</span>
      <span class="resource-name">${this.escapeHtml(resourceName)}</span>
    </div>
    <div class="toolbar-right">
      <button id="copyBtn" class="btn">Copy Mermaid</button>
      <button id="exportSvgBtn" class="btn">Export SVG</button>
      <button id="exportPngBtn" class="btn">Export PNG</button>
      <button id="zoomInBtn" class="btn">+</button>
      <button id="zoomOutBtn" class="btn">-</button>
      <button id="resetBtn" class="btn">Reset</button>
    </div>
  </div>

  <div class="diagram-container" id="diagramContainer">
    <div class="diagram-wrapper" id="diagramWrapper">
      <div id="diagram"></div>
    </div>
  </div>

  <script nonce="${nonce}" type="module">
    import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';

    const vscode = acquireVsCodeApi();
    const mermaidCode = ${JSON.stringify(mermaidCode)};

    // Initialize Mermaid with theme detection
    const isDark = document.body.classList.contains('vscode-dark') ||
                   window.matchMedia('(prefers-color-scheme: dark)').matches;

    mermaid.initialize({
      startOnLoad: false,
      theme: isDark ? 'dark' : 'default',
      flowchart: {
        useMaxWidth: false,
        htmlLabels: true,
        curve: 'basis'
      },
      securityLevel: 'loose'
    });

    // Render diagram
    const container = document.getElementById('diagram');
    try {
      const { svg } = await mermaid.render('mermaid-diagram', mermaidCode);
      container.innerHTML = svg;
    } catch (error) {
      container.innerHTML = '<pre class="error">Error rendering diagram: ' + error.message + '</pre>';
    }

    // Zoom and pan functionality
    let scale = 1;
    let translateX = 0;
    let translateY = 0;
    let isDragging = false;
    let lastX = 0;
    let lastY = 0;

    const wrapper = document.getElementById('diagramWrapper');
    const diagramContainer = document.getElementById('diagramContainer');

    function updateTransform() {
      wrapper.style.transform = \`translate(\${translateX}px, \${translateY}px) scale(\${scale})\`;
    }

    document.getElementById('zoomInBtn').addEventListener('click', () => {
      scale = Math.min(scale * 1.2, 5);
      updateTransform();
    });

    document.getElementById('zoomOutBtn').addEventListener('click', () => {
      scale = Math.max(scale / 1.2, 0.1);
      updateTransform();
    });

    document.getElementById('resetBtn').addEventListener('click', () => {
      scale = 1;
      translateX = 0;
      translateY = 0;
      updateTransform();
    });

    // Pan with mouse drag
    diagramContainer.addEventListener('mousedown', (e) => {
      isDragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      diagramContainer.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      translateX += e.clientX - lastX;
      translateY += e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      updateTransform();
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
      diagramContainer.style.cursor = 'grab';
    });

    // Zoom with scroll wheel
    diagramContainer.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      scale = Math.max(0.1, Math.min(5, scale * delta));
      updateTransform();
    });

    // Export buttons
    document.getElementById('copyBtn').addEventListener('click', () => {
      vscode.postMessage({ command: 'copyMermaid' });
    });

    document.getElementById('exportSvgBtn').addEventListener('click', () => {
      const svg = document.querySelector('#diagram svg');
      if (svg) {
        const svgData = new XMLSerializer().serializeToString(svg);
        vscode.postMessage({ command: 'exportSvg', data: svgData });
      }
    });

    document.getElementById('exportPngBtn').addEventListener('click', () => {
      const svg = document.querySelector('#diagram svg');
      if (svg) {
        const svgData = new XMLSerializer().serializeToString(svg);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();

        img.onload = () => {
          canvas.width = img.width * 2;
          canvas.height = img.height * 2;
          ctx.fillStyle = isDark ? '#1e1e1e' : '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          vscode.postMessage({ command: 'exportPng', data: canvas.toDataURL('image/png') });
        };

        img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
      }
    });
  </script>
</body>
</html>`;
  }

  /**
   * Get CSS styles for the webview
   */
  private getStyles(): string {
    return `
    * {
      box-sizing: border-box;
    }

    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-editor-foreground);
      background-color: var(--vscode-editor-background);
      margin: 0;
      padding: 0;
      height: 100vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 16px;
      background: linear-gradient(135deg, #6b2fad 0%, #0076d6 100%);
      border-bottom: 1px solid var(--vscode-panel-border);
      flex-shrink: 0;
    }

    .toolbar-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .title {
      color: rgba(255, 255, 255, 0.7);
      font-size: 12px;
    }

    .resource-name {
      color: white;
      font-weight: 600;
      font-size: 14px;
    }

    .toolbar-right {
      display: flex;
      gap: 8px;
    }

    .btn {
      background: rgba(255, 255, 255, 0.15);
      border: 1px solid rgba(255, 255, 255, 0.3);
      color: white;
      padding: 6px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      transition: all 0.15s;
    }

    .btn:hover {
      background: rgba(255, 255, 255, 0.25);
    }

    .diagram-container {
      flex: 1;
      overflow: hidden;
      cursor: grab;
      background-color: var(--vscode-editor-background);
    }

    .diagram-wrapper {
      transform-origin: center center;
      transition: transform 0.1s ease-out;
      display: inline-block;
      padding: 40px;
    }

    #diagram {
      min-width: 100%;
      min-height: 100%;
    }

    #diagram svg {
      max-width: none !important;
    }

    .error {
      color: var(--vscode-errorForeground);
      padding: 20px;
      white-space: pre-wrap;
    }

    /* Mermaid theme overrides */
    .node rect,
    .node circle,
    .node ellipse,
    .node polygon,
    .node path {
      stroke-width: 1px;
    }
    `;
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(text: string): string {
    const htmlEscapes: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return text.replace(/[&<>"']/g, (char) => htmlEscapes[char] || char);
  }

  /**
   * Dispose of the webview panel
   */
  dispose(): void {
    this.panel?.dispose();
  }
}
