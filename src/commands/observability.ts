import * as vscode from 'vscode';
import { ResourceNode } from '../tree/f5xcExplorer';
import { ProfileManager } from '../config/profiles';
import { withErrorHandling, showInfo, showWarning } from '../utils/errors';
import { getLogger } from '../utils/logger';

const logger = getLogger();

/**
 * Access log entry structure from F5 XC API
 */
interface AccessLogEntry {
  timestamp?: string;
  req_id?: string;
  src_ip?: string;
  method?: string;
  authority?: string;
  req_path?: string;
  rsp_code?: number;
  rsp_code_class?: string;
  duration?: number;
  user_agent?: string;
  country?: string;
  waf_action?: string;
  bot_classification?: string;
  [key: string]: unknown;
}

/**
 * Access logs response structure
 */
interface AccessLogsResponse {
  logs?: AccessLogEntry[];
  items?: AccessLogEntry[];
  total_hits?: number;
  aggs?: Record<string, unknown>;
}

/**
 * Metrics response structure
 */
interface MetricsResponse {
  data?: Array<{
    group_by?: Record<string, string>;
    values?: Array<{
      timestamp?: string;
      value?: number;
    }>;
    value?: number;
  }>;
  [key: string]: unknown;
}

/**
 * Register observability commands for F5 XC resources
 */
export function registerObservabilityCommands(
  context: vscode.ExtensionContext,
  profileManager: ProfileManager,
): void {
  // VIEW LOGS - View access logs for load balancer
  context.subscriptions.push(
    vscode.commands.registerCommand('f5xc.viewLogs', async (node: ResourceNode) => {
      await withErrorHandling(async () => {
        const data = node.getData();
        const profile = profileManager.getProfile(data.profileName);

        if (!profile) {
          showWarning(`Profile "${data.profileName}" not found`);
          return;
        }

        // Calculate time range (last 1 hour)
        const endTime = new Date();
        const startTime = new Date(endTime.getTime() - 60 * 60 * 1000);

        const client = await profileManager.getClient(data.profileName);

        // Fetch access logs
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: `Fetching logs for ${data.name}...`,
            cancellable: false,
          },
          async () => {
            try {
              const logsResponse = await client.customRequest<AccessLogsResponse>(
                `/api/data/namespaces/${data.namespace}/access_logs`,
                {
                  method: 'POST',
                  body: {
                    namespace: data.namespace,
                    query: `{vh_name="${data.name}"}`,
                    start_time: startTime.toISOString(),
                    end_time: endTime.toISOString(),
                    sort: 'SORT_DESCENDING',
                    limit: 100,
                    scroll: false,
                    aggs: {},
                  },
                },
              );

              const logs = logsResponse.logs || logsResponse.items || [];

              if (logs.length === 0) {
                showInfo(`No logs found for ${data.name} in the last hour`);
                return;
              }

              // Format logs for display
              const formattedLogs = formatAccessLogs(logs);

              // Display in a new document
              const doc = await vscode.workspace.openTextDocument({
                content: formattedLogs,
                language: 'log',
              });

              await vscode.window.showTextDocument(doc, { preview: false });
              logger.info(`Displayed ${logs.length} logs for ${data.name}`);
            } catch (error) {
              // If the API endpoint doesn't exist or returns an error, provide helpful message
              const err = error as Error;
              if (err.message?.includes('404') || err.message?.includes('not found')) {
                showWarning(`Access logs API not available. Try viewing logs in the F5 Console.`);
              } else {
                throw error;
              }
            }
          },
        );
      }, 'View logs');
    }),
  );

  // VIEW METRICS - View metrics for load balancer or origin pool
  context.subscriptions.push(
    vscode.commands.registerCommand('f5xc.viewMetrics', async (node: ResourceNode) => {
      await withErrorHandling(async () => {
        const data = node.getData();
        const profile = profileManager.getProfile(data.profileName);

        if (!profile) {
          showWarning(`Profile "${data.profileName}" not found`);
          return;
        }

        // Calculate time range (last 1 hour)
        const endTime = new Date();
        const startTime = new Date(endTime.getTime() - 60 * 60 * 1000);

        const client = await profileManager.getClient(data.profileName);

        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: `Fetching metrics for ${data.name}...`,
            cancellable: false,
          },
          async () => {
            try {
              // Determine metrics endpoint based on resource type
              const metricsPath = getMetricsPath(data.resourceTypeKey, data.namespace);

              const metricsResponse = await client.customRequest<MetricsResponse>(metricsPath, {
                method: 'POST',
                body: {
                  namespace: data.namespace,
                  filter: getMetricsFilter(data.resourceTypeKey, data.name),
                  start_time: startTime.toISOString(),
                  end_time: endTime.toISOString(),
                  step: '5m',
                  group_by: [],
                },
              });

              // Format metrics for display
              const formattedMetrics = formatMetrics(
                data.name,
                data.resourceTypeKey,
                metricsResponse,
              );

              // Display in a new document
              const doc = await vscode.workspace.openTextDocument({
                content: formattedMetrics,
                language: 'json',
              });

              await vscode.window.showTextDocument(doc, { preview: false });
              logger.info(`Displayed metrics for ${data.name}`);
            } catch (error) {
              // If the API endpoint doesn't exist or returns an error, provide helpful message
              const err = error as Error;
              if (err.message?.includes('404') || err.message?.includes('not found')) {
                showWarning(`Metrics API not available. Try viewing metrics in the F5 Console.`);
              } else {
                throw error;
              }
            }
          },
        );
      }, 'View metrics');
    }),
  );
}

/**
 * Get the metrics API path based on resource type
 */
function getMetricsPath(resourceTypeKey: string, namespace: string): string {
  switch (resourceTypeKey) {
    case 'http_loadbalancer':
    case 'tcp_loadbalancer':
      return `/api/data/namespaces/${namespace}/app_type/adn/metrics`;
    case 'origin_pool':
      return `/api/data/namespaces/${namespace}/origin_pool/metrics`;
    default:
      return `/api/data/namespaces/${namespace}/metrics`;
  }
}

/**
 * Get metrics filter based on resource type
 */
function getMetricsFilter(resourceTypeKey: string, name: string): string {
  switch (resourceTypeKey) {
    case 'http_loadbalancer':
    case 'tcp_loadbalancer':
      return `{vh_name="${name}"}`;
    case 'origin_pool':
      return `{origin_pool="${name}"}`;
    default:
      return `{name="${name}"}`;
  }
}

/**
 * Format access logs for display
 */
function formatAccessLogs(logs: AccessLogEntry[]): string {
  const lines: string[] = [
    '# F5 XC Access Logs',
    `# Generated: ${new Date().toISOString()}`,
    `# Total entries: ${logs.length}`,
    '',
    '='.repeat(120),
    '',
  ];

  for (const log of logs) {
    const timestamp = log.timestamp || 'N/A';
    const method = log.method || '-';
    const authority = log.authority || '-';
    const path = log.req_path || '/';
    const status = log.rsp_code || '-';
    const duration = log.duration ? `${log.duration}ms` : '-';
    const srcIp = log.src_ip || '-';
    const country = log.country || '-';
    const wafAction = log.waf_action || '-';

    lines.push(`[${timestamp}] ${method} ${authority}${path} -> ${status} (${duration})`);
    lines.push(`  Source: ${srcIp} (${country}) | WAF: ${wafAction}`);

    if (log.user_agent) {
      lines.push(
        `  UA: ${log.user_agent.substring(0, 80)}${log.user_agent.length > 80 ? '...' : ''}`,
      );
    }

    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Format metrics response for display
 */
function formatMetrics(name: string, resourceTypeKey: string, response: MetricsResponse): string {
  const output = {
    resource: name,
    type: resourceTypeKey,
    timestamp: new Date().toISOString(),
    timeRange: 'Last 1 hour',
    metrics: response.data || response,
  };

  return JSON.stringify(output, null, 2);
}
