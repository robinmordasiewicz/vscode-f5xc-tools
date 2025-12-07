import { geocodeLocation } from '../../api/geocoder';

// Mock the logger module
jest.mock('../../utils/logger', () => ({
  getLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('geocodeLocation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return coordinates for a valid location', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue([
        {
          lat: '39.0438',
          lon: '-77.4874',
        },
      ]),
    });

    const result = await geocodeLocation('Ashburn, VA, United States');

    expect(result).toEqual({
      latitude: 39.0438,
      longitude: -77.4874,
    });
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('https://nominatim.openstreetmap.org/search'),
      expect.objectContaining({
        headers: {
          'User-Agent': 'VSCode-F5XC-Tools/1.0',
        },
      }),
    );
  });

  it('should include correct query parameters', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue([{ lat: '10', lon: '20' }]),
    });

    await geocodeLocation('Test City');

    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain('q=Test+City');
    expect(calledUrl).toContain('format=json');
    expect(calledUrl).toContain('limit=1');
  });

  it('should return null when no results found', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue([]),
    });

    const result = await geocodeLocation('NonexistentPlace12345');

    expect(result).toBeNull();
  });

  it('should return null when response is not ok', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: jest.fn(),
    });

    const result = await geocodeLocation('Ashburn, VA');

    expect(result).toBeNull();
  });

  it('should return null when fetch throws an error', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const result = await geocodeLocation('Ashburn, VA');

    expect(result).toBeNull();
  });

  it('should return null when JSON parsing fails', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockRejectedValue(new Error('Invalid JSON')),
    });

    const result = await geocodeLocation('Ashburn, VA');

    expect(result).toBeNull();
  });

  it('should parse coordinates as floats', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue([
        {
          lat: '51.5074',
          lon: '-0.1278',
        },
      ]),
    });

    const result = await geocodeLocation('London, UK');

    expect(result).toEqual({
      latitude: 51.5074,
      longitude: -0.1278,
    });
    expect(typeof result?.latitude).toBe('number');
    expect(typeof result?.longitude).toBe('number');
  });

  it('should handle negative coordinates', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue([
        {
          lat: '-33.8688',
          lon: '151.2093',
        },
      ]),
    });

    const result = await geocodeLocation('Sydney, Australia');

    expect(result).toEqual({
      latitude: -33.8688,
      longitude: 151.2093,
    });
  });

  it('should encode special characters in query', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue([{ lat: '-23.5505', lon: '-46.6333' }]),
    });

    await geocodeLocation('São Paulo, Brazil');

    const calledUrl = mockFetch.mock.calls[0][0];
    // URLSearchParams should encode special characters
    expect(calledUrl).toContain('S%C3%A3o+Paulo');
  });

  it('should return first result when multiple results returned', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue([
        { lat: '10.0', lon: '20.0' },
        { lat: '30.0', lon: '40.0' },
      ]),
    });

    const result = await geocodeLocation('Ambiguous City');

    expect(result).toEqual({
      latitude: 10.0,
      longitude: 20.0,
    });
  });

  it('should handle rate limiting (429 status)', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 429,
    });

    const result = await geocodeLocation('Ashburn, VA');

    expect(result).toBeNull();
  });
});
