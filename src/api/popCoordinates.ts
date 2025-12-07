/**
 * PoP Coordinates Module
 * Static mapping of known F5 Regional Edge PoP coordinates with geocoding fallback support
 */

export interface Coordinates {
  latitude: number;
  longitude: number;
}

/**
 * Static mapping of known F5 Regional Edge PoP locations
 * Site codes extracted from Cloud Status names (e.g., "dc12" from "Ashburn (dc12)")
 */
export const POP_COORDINATES: Record<string, Coordinates> = {
  // North America
  dc12: { latitude: 39.0438, longitude: -77.4874 }, // Ashburn, VA
  sv10: { latitude: 37.3861, longitude: -122.0839 }, // Santa Clara, CA
  se4: { latitude: 47.6062, longitude: -122.3321 }, // Seattle, WA
  ch2: { latitude: 41.8781, longitude: -87.6298 }, // Chicago, IL
  da3: { latitude: 32.7767, longitude: -96.797 }, // Dallas, TX
  ny8: { latitude: 40.7128, longitude: -74.006 }, // New York, NY
  la3: { latitude: 34.0522, longitude: -118.2437 }, // Los Angeles, CA
  at2: { latitude: 33.749, longitude: -84.388 }, // Atlanta, GA
  mi3: { latitude: 25.7617, longitude: -80.1918 }, // Miami, FL
  mo2: { latitude: 45.5017, longitude: -73.5673 }, // Montreal, Canada
  to2: { latitude: 43.6532, longitude: -79.3832 }, // Toronto, Canada

  // Europe
  fra: { latitude: 50.1109, longitude: 8.6821 }, // Frankfurt, Germany
  ld5: { latitude: 51.5074, longitude: -0.1278 }, // London, UK
  pa4: { latitude: 48.8566, longitude: 2.3522 }, // Paris, France
  am2: { latitude: 52.3676, longitude: 4.9041 }, // Amsterdam, Netherlands
  mu2: { latitude: 48.1351, longitude: 11.582 }, // Munich, Germany
  st2: { latitude: 59.3293, longitude: 18.0686 }, // Stockholm, Sweden
  ma2: { latitude: 40.4168, longitude: -3.7038 }, // Madrid, Spain
  mi5: { latitude: 45.4642, longitude: 9.19 }, // Milan, Italy

  // Asia Pacific
  sg3: { latitude: 1.3521, longitude: 103.8198 }, // Singapore
  ty8: { latitude: 35.6762, longitude: 139.6503 }, // Tokyo, Japan
  os2: { latitude: 34.6937, longitude: 135.5023 }, // Osaka, Japan
  sy4: { latitude: -33.8688, longitude: 151.2093 }, // Sydney, Australia
  hk3: { latitude: 22.3193, longitude: 114.1694 }, // Hong Kong
  mu3: { latitude: 19.076, longitude: 72.8777 }, // Mumbai, India
  bl2: { latitude: 12.9716, longitude: 77.5946 }, // Bangalore, India

  // South America
  sp3: { latitude: -23.5505, longitude: -46.6333 }, // São Paulo, Brazil
  ba2: { latitude: -34.6037, longitude: -58.3816 }, // Buenos Aires, Argentina

  // Middle East & Africa
  jb2: { latitude: 25.2048, longitude: 55.2708 }, // Dubai, UAE
  jh2: { latitude: -26.2041, longitude: 28.0473 }, // Johannesburg, SA
};

/**
 * Parse location components from Cloud Status PoP name
 * Pattern: "City (code), State/Region, Country" or "City, Country" or "City"
 */
export function parsePopLocation(
  popName: string,
): { city: string; region?: string; country?: string } | null {
  // Remove site code in parentheses first
  const cleanName = popName.replace(/\s*\([^)]+\)/, '').trim();
  const parts = cleanName.split(',').map((p) => p.trim());

  if (parts.length === 0 || !parts[0]) {
    return null;
  }

  const city = parts[0];

  if (parts.length === 1) {
    return { city };
  } else if (parts.length === 2) {
    return { city, country: parts[1] };
  } else {
    return { city, region: parts[1], country: parts[2] };
  }
}

/**
 * Get coordinates for a PoP - tries static map first, then optional geocoding fallback
 * @param siteCode Site code extracted from PoP name (e.g., "dc12")
 * @param popName Full PoP name for geocoding fallback
 * @param geocoder Optional geocoding function for unknown PoPs
 */
export async function getPopCoordinates(
  siteCode: string | null,
  popName: string,
  geocoder?: (query: string) => Promise<Coordinates | null>,
): Promise<Coordinates | null> {
  // 1. Try static mapping by site code
  if (siteCode) {
    const staticCoords = POP_COORDINATES[siteCode.toLowerCase()];
    if (staticCoords) {
      return staticCoords;
    }
  }

  // 2. Fall back to geocoding if provided
  if (geocoder) {
    const location = parsePopLocation(popName);
    if (location) {
      const query = [location.city, location.region, location.country].filter(Boolean).join(', ');
      return await geocoder(query);
    }
  }

  return null;
}

/**
 * Format coordinates for display
 * @param coords Coordinates object or null
 * @returns Formatted string like "39.0438°N, 77.4874°W" or "N/A"
 */
export function formatCoordinates(coords: Coordinates | null): string {
  if (!coords) {
    return 'N/A';
  }
  const latDir = coords.latitude >= 0 ? 'N' : 'S';
  const lonDir = coords.longitude >= 0 ? 'E' : 'W';
  return `${Math.abs(coords.latitude).toFixed(4)}°${latDir}, ${Math.abs(coords.longitude).toFixed(4)}°${lonDir}`;
}
