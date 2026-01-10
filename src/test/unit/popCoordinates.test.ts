// Copyright (c) 2026 Robin Mordasiewicz. MIT License.

import {
  Coordinates,
  POP_COORDINATES,
  parsePopLocation,
  getPopCoordinates,
  formatCoordinates,
} from '../../api/popCoordinates';

describe('POP_COORDINATES', () => {
  it('should contain known PoP coordinates', () => {
    expect(POP_COORDINATES).toHaveProperty('dc12');
    expect(POP_COORDINATES).toHaveProperty('sv10');
    expect(POP_COORDINATES).toHaveProperty('fra');
    expect(POP_COORDINATES).toHaveProperty('sg3');
  });

  it('should have valid coordinate ranges', () => {
    for (const [, coords] of Object.entries(POP_COORDINATES)) {
      expect(coords.latitude).toBeGreaterThanOrEqual(-90);
      expect(coords.latitude).toBeLessThanOrEqual(90);
      expect(coords.longitude).toBeGreaterThanOrEqual(-180);
      expect(coords.longitude).toBeLessThanOrEqual(180);
    }
  });

  it('should have Ashburn coordinates for dc12', () => {
    expect(POP_COORDINATES['dc12']).toEqual({
      latitude: 39.0438,
      longitude: -77.4874,
    });
  });
});

describe('parsePopLocation', () => {
  it('should parse location with site code, city, state, and country', () => {
    const result = parsePopLocation('Ashburn (dc12), VA, United States');
    expect(result).toEqual({
      city: 'Ashburn',
      region: 'VA',
      country: 'United States',
    });
  });

  it('should parse location with city and country only', () => {
    const result = parsePopLocation('Frankfurt, Germany');
    expect(result).toEqual({
      city: 'Frankfurt',
      country: 'Germany',
    });
  });

  it('should parse location with city only', () => {
    const result = parsePopLocation('Singapore');
    expect(result).toEqual({
      city: 'Singapore',
    });
  });

  it('should parse location with site code and city only', () => {
    const result = parsePopLocation('Singapore (sg3)');
    expect(result).toEqual({
      city: 'Singapore',
    });
  });

  it('should handle São Paulo with special characters', () => {
    const result = parsePopLocation('São Paulo (sp3), Brazil');
    expect(result).toEqual({
      city: 'São Paulo',
      country: 'Brazil',
    });
  });

  it('should return null for empty string', () => {
    const result = parsePopLocation('');
    expect(result).toBeNull();
  });

  it('should return null for whitespace only', () => {
    const result = parsePopLocation('   ');
    expect(result).toBeNull();
  });

  it('should trim whitespace from parts', () => {
    const result = parsePopLocation('  London  ,  UK  ');
    expect(result).toEqual({
      city: 'London',
      country: 'UK',
    });
  });
});

describe('getPopCoordinates', () => {
  it('should return coordinates from static map when site code is found', async () => {
    const result = await getPopCoordinates('dc12', 'Ashburn (dc12), VA, United States');
    expect(result).toEqual({
      latitude: 39.0438,
      longitude: -77.4874,
    });
  });

  it('should return coordinates case-insensitively', async () => {
    const result = await getPopCoordinates('DC12', 'Ashburn (DC12), VA, United States');
    expect(result).toEqual({
      latitude: 39.0438,
      longitude: -77.4874,
    });
  });

  it('should return null when site code not found and no geocoder provided', async () => {
    const result = await getPopCoordinates('unknown', 'Unknown City, Country');
    expect(result).toBeNull();
  });

  it('should return null when site code is null and no geocoder provided', async () => {
    const result = await getPopCoordinates(null, 'Some City, Country');
    expect(result).toBeNull();
  });

  it('should use geocoder fallback when site code not in static map', async () => {
    const mockGeocoder = jest.fn().mockResolvedValue({
      latitude: 10.0,
      longitude: 20.0,
    });

    const result = await getPopCoordinates('unknown', 'Test City, Test Country', mockGeocoder);
    expect(result).toEqual({
      latitude: 10.0,
      longitude: 20.0,
    });
    expect(mockGeocoder).toHaveBeenCalledWith('Test City, Test Country');
  });

  it('should use geocoder fallback when site code is null', async () => {
    const mockGeocoder = jest.fn().mockResolvedValue({
      latitude: 30.0,
      longitude: 40.0,
    });

    const result = await getPopCoordinates(null, 'Another City, Country', mockGeocoder);
    expect(result).toEqual({
      latitude: 30.0,
      longitude: 40.0,
    });
    expect(mockGeocoder).toHaveBeenCalledWith('Another City, Country');
  });

  it('should not use geocoder when site code found in static map', async () => {
    const mockGeocoder = jest.fn();

    const result = await getPopCoordinates('dc12', 'Ashburn (dc12)', mockGeocoder);
    expect(result).toEqual({
      latitude: 39.0438,
      longitude: -77.4874,
    });
    expect(mockGeocoder).not.toHaveBeenCalled();
  });

  it('should return null when geocoder returns null', async () => {
    const mockGeocoder = jest.fn().mockResolvedValue(null);

    const result = await getPopCoordinates('unknown', 'Unknown City', mockGeocoder);
    expect(result).toBeNull();
  });

  it('should handle geocoder with city, region, and country', async () => {
    const mockGeocoder = jest.fn().mockResolvedValue({
      latitude: 50.0,
      longitude: 60.0,
    });

    const result = await getPopCoordinates(
      'unknown',
      'Ashburn (unknown), VA, United States',
      mockGeocoder,
    );
    expect(result).toEqual({
      latitude: 50.0,
      longitude: 60.0,
    });
    expect(mockGeocoder).toHaveBeenCalledWith('Ashburn, VA, United States');
  });
});

describe('formatCoordinates', () => {
  it('should format positive latitude and longitude', () => {
    const coords: Coordinates = { latitude: 39.0438, longitude: 8.6821 };
    const result = formatCoordinates(coords);
    expect(result).toBe('39.0438°N, 8.6821°E');
  });

  it('should format negative latitude (South)', () => {
    const coords: Coordinates = { latitude: -33.8688, longitude: 151.2093 };
    const result = formatCoordinates(coords);
    expect(result).toBe('33.8688°S, 151.2093°E');
  });

  it('should format negative longitude (West)', () => {
    const coords: Coordinates = { latitude: 39.0438, longitude: -77.4874 };
    const result = formatCoordinates(coords);
    expect(result).toBe('39.0438°N, 77.4874°W');
  });

  it('should format both negative coordinates', () => {
    const coords: Coordinates = { latitude: -23.5505, longitude: -46.6333 };
    const result = formatCoordinates(coords);
    expect(result).toBe('23.5505°S, 46.6333°W');
  });

  it('should return N/A for null coordinates', () => {
    const result = formatCoordinates(null);
    expect(result).toBe('N/A');
  });

  it('should handle zero coordinates', () => {
    const coords: Coordinates = { latitude: 0, longitude: 0 };
    const result = formatCoordinates(coords);
    expect(result).toBe('0.0000°N, 0.0000°E');
  });

  it('should format to 4 decimal places', () => {
    const coords: Coordinates = { latitude: 39.04381234, longitude: -77.48741234 };
    const result = formatCoordinates(coords);
    expect(result).toBe('39.0438°N, 77.4874°W');
  });
});
