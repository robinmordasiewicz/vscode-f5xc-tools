// Copyright (c) 2026 Robin Mordasiewicz. MIT License.

import {
  CloudStatusClient,
  getStatusDisplayText,
  getStatusSeverity,
  getIncidentStatusText,
  ComponentStatus,
  SummaryResponse,
} from '../../api/cloudStatus';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('getStatusDisplayText', () => {
  it('should return "Operational" for operational status', () => {
    expect(getStatusDisplayText('operational')).toBe('Operational');
  });

  it('should return "Degraded" for degraded_performance status', () => {
    expect(getStatusDisplayText('degraded_performance')).toBe('Degraded');
  });

  it('should return "Partial Outage" for partial_outage status', () => {
    expect(getStatusDisplayText('partial_outage')).toBe('Partial Outage');
  });

  it('should return "Major Outage" for major_outage status', () => {
    expect(getStatusDisplayText('major_outage')).toBe('Major Outage');
  });

  it('should return "Maintenance" for under_maintenance status', () => {
    expect(getStatusDisplayText('under_maintenance')).toBe('Maintenance');
  });

  it('should return "Unknown" for unknown status', () => {
    expect(getStatusDisplayText('unknown' as ComponentStatus)).toBe('Unknown');
  });
});

describe('getStatusSeverity', () => {
  it('should return 0 for operational', () => {
    expect(getStatusSeverity('operational')).toBe(0);
  });

  it('should return 1 for degraded_performance', () => {
    expect(getStatusSeverity('degraded_performance')).toBe(1);
  });

  it('should return 2 for partial_outage', () => {
    expect(getStatusSeverity('partial_outage')).toBe(2);
  });

  it('should return 3 for major_outage', () => {
    expect(getStatusSeverity('major_outage')).toBe(3);
  });

  it('should return 4 for under_maintenance', () => {
    expect(getStatusSeverity('under_maintenance')).toBe(4);
  });

  it('should return 5 for unknown status', () => {
    expect(getStatusSeverity('unknown' as ComponentStatus)).toBe(5);
  });

  it('should order statuses from best to worst', () => {
    const statuses: ComponentStatus[] = [
      'operational',
      'degraded_performance',
      'partial_outage',
      'major_outage',
      'under_maintenance',
    ];
    const severities = statuses.map(getStatusSeverity);
    // Each severity should be greater than the previous
    for (let i = 1; i < severities.length; i++) {
      const current = severities[i] as number;
      const previous = severities[i - 1] as number;
      expect(current).toBeGreaterThan(previous);
    }
  });
});

describe('getIncidentStatusText', () => {
  // Incident statuses
  it('should return "Investigating" for investigating status', () => {
    expect(getIncidentStatusText('investigating')).toBe('Investigating');
  });

  it('should return "Identified" for identified status', () => {
    expect(getIncidentStatusText('identified')).toBe('Identified');
  });

  it('should return "Monitoring" for monitoring status', () => {
    expect(getIncidentStatusText('monitoring')).toBe('Monitoring');
  });

  it('should return "Resolved" for resolved status', () => {
    expect(getIncidentStatusText('resolved')).toBe('Resolved');
  });

  it('should return "Postmortem" for postmortem status', () => {
    expect(getIncidentStatusText('postmortem')).toBe('Postmortem');
  });

  // Maintenance statuses
  it('should return "Scheduled" for scheduled status', () => {
    expect(getIncidentStatusText('scheduled')).toBe('Scheduled');
  });

  it('should return "In Progress" for in_progress status', () => {
    expect(getIncidentStatusText('in_progress')).toBe('In Progress');
  });

  it('should return "Verifying" for verifying status', () => {
    expect(getIncidentStatusText('verifying')).toBe('Verifying');
  });

  it('should return "Completed" for completed status', () => {
    expect(getIncidentStatusText('completed')).toBe('Completed');
  });

  it('should return "Unknown" for unknown status', () => {
    expect(getIncidentStatusText('unknown' as 'investigating')).toBe('Unknown');
  });
});

describe('CloudStatusClient', () => {
  let client: CloudStatusClient;

  beforeEach(() => {
    client = new CloudStatusClient();
    mockFetch.mockReset();
  });

  afterEach(() => {
    client.clearCache();
  });

  const mockSummaryResponse: SummaryResponse = {
    page: {
      id: 'test-page',
      name: 'F5 Cloud Status',
      url: 'https://www.f5cloudstatus.com',
      time_zone: 'Etc/UTC',
      updated_at: '2024-01-01T00:00:00.000Z',
    },
    status: {
      indicator: 'none',
      description: 'All Systems Operational',
    },
    components: [
      {
        id: 'comp-1',
        name: 'Test Component',
        status: 'operational',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z',
        position: 1,
        description: 'A test component',
        showcase: true,
        start_date: null,
        group_id: null,
        page_id: 'test-page',
        group: false,
        only_show_if_degraded: false,
      },
    ],
    incidents: [],
    scheduled_maintenances: [],
  };

  describe('getSummary', () => {
    it('should fetch summary from API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSummaryResponse),
      });

      const result = await client.getSummary();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://www.f5cloudstatus.com/api/v2/summary.json',
        expect.objectContaining({
          method: 'GET',
          headers: { Accept: 'application/json' },
        }),
      );
      expect(result).toEqual(mockSummaryResponse);
    });

    it('should cache responses', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockSummaryResponse),
      });

      // First call
      await client.getSummary();
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second call should use cache
      await client.getSummary();
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should throw error for non-OK response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(client.getSummary()).rejects.toThrow('HTTP 500: Internal Server Error');
    });
  });

  describe('getStatus', () => {
    it('should fetch status from API', async () => {
      const mockStatus = {
        page: mockSummaryResponse.page,
        status: mockSummaryResponse.status,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockStatus),
      });

      const result = await client.getStatus();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://www.f5cloudstatus.com/api/v2/status.json',
        expect.any(Object),
      );
      expect(result.status.indicator).toBe('none');
    });
  });

  describe('getComponents', () => {
    it('should fetch components from API', async () => {
      const mockComponents = {
        page: mockSummaryResponse.page,
        components: mockSummaryResponse.components,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockComponents),
      });

      const result = await client.getComponents();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://www.f5cloudstatus.com/api/v2/components.json',
        expect.any(Object),
      );
      expect(result.components).toHaveLength(1);
    });
  });

  describe('getIncidents', () => {
    it('should fetch incidents from API', async () => {
      const mockIncidents = {
        page: mockSummaryResponse.page,
        incidents: [],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockIncidents),
      });

      const result = await client.getIncidents();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://www.f5cloudstatus.com/api/v2/incidents.json',
        expect.any(Object),
      );
      expect(result.incidents).toHaveLength(0);
    });
  });

  describe('getIncidentsUnresolved', () => {
    it('should fetch unresolved incidents from API', async () => {
      const mockIncidents = {
        page: mockSummaryResponse.page,
        incidents: [],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockIncidents),
      });

      const result = await client.getIncidentsUnresolved();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://www.f5cloudstatus.com/api/v2/incidents/unresolved.json',
        expect.any(Object),
      );
      expect(result.incidents).toHaveLength(0);
    });
  });

  describe('getScheduledMaintenances', () => {
    it('should fetch scheduled maintenances from API', async () => {
      const mockMaintenances = {
        page: mockSummaryResponse.page,
        scheduled_maintenances: [],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockMaintenances),
      });

      const result = await client.getScheduledMaintenances();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://www.f5cloudstatus.com/api/v2/scheduled-maintenances.json',
        expect.any(Object),
      );
      expect(result.scheduled_maintenances).toHaveLength(0);
    });
  });

  describe('getUpcomingMaintenances', () => {
    it('should fetch upcoming maintenances from API', async () => {
      const mockMaintenances = {
        page: mockSummaryResponse.page,
        scheduled_maintenances: [],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockMaintenances),
      });

      const result = await client.getUpcomingMaintenances();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://www.f5cloudstatus.com/api/v2/scheduled-maintenances/upcoming.json',
        expect.any(Object),
      );
      expect(result.scheduled_maintenances).toHaveLength(0);
    });
  });

  describe('clearCache', () => {
    it('should clear the cache', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockSummaryResponse),
      });

      // First call
      await client.getSummary();
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Clear cache
      client.clearCache();

      // Second call should fetch again
      await client.getSummary();
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('cache TTL', () => {
    it('should use custom TTL when provided', async () => {
      // Create client with very short TTL
      const shortTtlClient = new CloudStatusClient(1);

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockSummaryResponse),
      });

      // First call
      await shortTtlClient.getSummary();
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Wait for cache to expire
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Second call should fetch again (cache expired)
      await shortTtlClient.getSummary();
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});
