// Copyright (c) 2026 Robin Mordasiewicz. MIT License.

/**
 * Geocoder Module
 * Nominatim (OpenStreetMap) geocoding wrapper for location lookup
 */

import { Coordinates } from './popCoordinates';
import { getLogger } from '../utils/logger';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const logger = getLogger();

/**
 * Geocode a location string using Nominatim (OpenStreetMap)
 * Free, no API key required, 1 request/second rate limit
 * @param query Location query string (e.g., "Ashburn, VA, United States")
 * @returns Coordinates or null if geocoding fails
 */
export async function geocodeLocation(query: string): Promise<Coordinates | null> {
  try {
    const params = new URLSearchParams({
      q: query,
      format: 'json',
      limit: '1',
    });

    const response = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
      headers: {
        'User-Agent': 'VSCode-F5XC-Tools/1.0',
      },
    });

    if (!response.ok) {
      logger.warn(`Nominatim geocoding failed with status ${response.status} for query: ${query}`);
      return null;
    }

    const results = (await response.json()) as Array<{ lat: string; lon: string }>;
    const firstResult = results[0];
    if (firstResult) {
      const coords = {
        latitude: parseFloat(firstResult.lat),
        longitude: parseFloat(firstResult.lon),
      };
      logger.debug(`Geocoded "${query}" to ${coords.latitude}, ${coords.longitude}`);
      return coords;
    }

    logger.debug(`No geocoding results for query: ${query}`);
    return null;
  } catch (error) {
    logger.warn(`Geocoding error for "${query}":`, error);
    return null;
  }
}
