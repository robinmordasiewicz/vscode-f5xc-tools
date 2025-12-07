/**
 * F5 Cloud Status API Client
 * Fetches status information from https://www.f5cloudstatus.com (Statuspage.io API)
 */

const CLOUD_STATUS_BASE_URL = 'https://www.f5cloudstatus.com/api/v2';
const DEFAULT_CACHE_TTL_MS = 60000; // 60 seconds

export type StatusIndicator = 'none' | 'minor' | 'major' | 'critical' | 'maintenance';
export type ComponentStatus =
  | 'operational'
  | 'degraded_performance'
  | 'partial_outage'
  | 'major_outage'
  | 'under_maintenance';

export interface PageInfo {
  id: string;
  name: string;
  url: string;
  time_zone: string;
  updated_at: string;
}

export interface StatusResponse {
  page: PageInfo;
  status: {
    indicator: StatusIndicator;
    description: string;
  };
}

export interface Component {
  id: string;
  name: string;
  status: ComponentStatus;
  created_at: string;
  updated_at: string;
  position: number;
  description: string | null;
  showcase: boolean;
  start_date: string | null;
  group_id: string | null;
  page_id: string;
  group: boolean;
  only_show_if_degraded: boolean;
  components?: string[]; // For groups, IDs of child components
}

export interface IncidentUpdate {
  id: string;
  status: string;
  body: string;
  incident_id: string;
  created_at: string;
  updated_at: string;
  display_at: string;
  affected_components: Array<{
    code: string;
    name: string;
    old_status: ComponentStatus;
    new_status: ComponentStatus;
  }>;
}

export interface Incident {
  id: string;
  name: string;
  status: 'investigating' | 'identified' | 'monitoring' | 'resolved' | 'postmortem';
  created_at: string;
  updated_at: string;
  monitoring_at: string | null;
  resolved_at: string | null;
  impact: 'none' | 'minor' | 'major' | 'critical';
  shortlink: string;
  started_at: string;
  page_id: string;
  incident_updates: IncidentUpdate[];
  components: Component[];
}

export interface ScheduledMaintenance {
  id: string;
  name: string;
  status: 'scheduled' | 'in_progress' | 'verifying' | 'completed';
  created_at: string;
  updated_at: string;
  monitoring_at: string | null;
  resolved_at: string | null;
  impact: 'none' | 'minor' | 'major' | 'critical' | 'maintenance';
  shortlink: string;
  started_at: string | null;
  page_id: string;
  scheduled_for: string;
  scheduled_until: string;
  incident_updates: IncidentUpdate[];
  components: Component[];
}

export interface SummaryResponse {
  page: PageInfo;
  status: {
    indicator: StatusIndicator;
    description: string;
  };
  components: Component[];
  incidents: Incident[];
  scheduled_maintenances: ScheduledMaintenance[];
}

export interface ComponentsResponse {
  page: PageInfo;
  components: Component[];
}

export interface IncidentsResponse {
  page: PageInfo;
  incidents: Incident[];
}

export interface ScheduledMaintenancesResponse {
  page: PageInfo;
  scheduled_maintenances: ScheduledMaintenance[];
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

/**
 * Client for F5 Cloud Status API
 */
export class CloudStatusClient {
  private cache = new Map<string, CacheEntry<unknown>>();
  private cacheTtlMs: number;

  constructor(cacheTtlMs = DEFAULT_CACHE_TTL_MS) {
    this.cacheTtlMs = cacheTtlMs;
  }

  private getCached<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) {
      return null;
    }
    if (Date.now() - entry.timestamp > this.cacheTtlMs) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  private setCache<T>(key: string, data: T): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  clearCache(): void {
    this.cache.clear();
  }

  private async fetch<T>(endpoint: string): Promise<T> {
    const cacheKey = endpoint;
    const cached = this.getCached<T>(cacheKey);
    if (cached) {
      return cached;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(`${CLOUD_STATUS_BASE_URL}${endpoint}`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as T;
      this.setCache(cacheKey, data);
      return data;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Get overall status indicator
   */
  async getStatus(): Promise<StatusResponse> {
    return this.fetch<StatusResponse>('/status.json');
  }

  /**
   * Get full summary including components, incidents, and maintenance
   */
  async getSummary(): Promise<SummaryResponse> {
    return this.fetch<SummaryResponse>('/summary.json');
  }

  /**
   * Get all components
   */
  async getComponents(): Promise<ComponentsResponse> {
    return this.fetch<ComponentsResponse>('/components.json');
  }

  /**
   * Get all active incidents
   */
  async getIncidents(): Promise<IncidentsResponse> {
    return this.fetch<IncidentsResponse>('/incidents.json');
  }

  /**
   * Get all active incidents (including resolved)
   */
  async getIncidentsUnresolved(): Promise<IncidentsResponse> {
    return this.fetch<IncidentsResponse>('/incidents/unresolved.json');
  }

  /**
   * Get scheduled maintenances
   */
  async getScheduledMaintenances(): Promise<ScheduledMaintenancesResponse> {
    return this.fetch<ScheduledMaintenancesResponse>('/scheduled-maintenances.json');
  }

  /**
   * Get upcoming scheduled maintenances
   */
  async getUpcomingMaintenances(): Promise<ScheduledMaintenancesResponse> {
    return this.fetch<ScheduledMaintenancesResponse>('/scheduled-maintenances/upcoming.json');
  }
}

/**
 * Get display-friendly status text
 */
export function getStatusDisplayText(status: ComponentStatus): string {
  switch (status) {
    case 'operational':
      return 'Operational';
    case 'degraded_performance':
      return 'Degraded';
    case 'partial_outage':
      return 'Partial Outage';
    case 'major_outage':
      return 'Major Outage';
    case 'under_maintenance':
      return 'Maintenance';
    default:
      return 'Unknown';
  }
}

/**
 * Get severity level for sorting (lower = better)
 */
export function getStatusSeverity(status: ComponentStatus): number {
  switch (status) {
    case 'operational':
      return 0;
    case 'degraded_performance':
      return 1;
    case 'partial_outage':
      return 2;
    case 'major_outage':
      return 3;
    case 'under_maintenance':
      return 4;
    default:
      return 5;
  }
}

/**
 * Get incident status display text
 */
export function getIncidentStatusText(
  status: Incident['status'] | ScheduledMaintenance['status'],
): string {
  switch (status) {
    case 'investigating':
      return 'Investigating';
    case 'identified':
      return 'Identified';
    case 'monitoring':
      return 'Monitoring';
    case 'resolved':
      return 'Resolved';
    case 'postmortem':
      return 'Postmortem';
    case 'scheduled':
      return 'Scheduled';
    case 'in_progress':
      return 'In Progress';
    case 'verifying':
      return 'Verifying';
    case 'completed':
      return 'Completed';
    default:
      return 'Unknown';
  }
}
