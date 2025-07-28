// Simple zipcode to lat/lng mapping for demo purposes
// In production, use a proper geocoding service like Google Maps API or Mapbox

export const zipcodeCoordinates: Record<string, { lat: number; lng: number }> = {
  // Major US cities
  "10001": { lat: 40.7509, lng: -73.9983 }, // New York, NY
  "90001": { lat: 33.9731, lng: -118.2479 }, // Los Angeles, CA
  "60601": { lat: 41.8857, lng: -87.6181 }, // Chicago, IL
  "77001": { lat: 29.7523, lng: -95.3677 }, // Houston, TX
  "85001": { lat: 33.4495, lng: -112.0773 }, // Phoenix, AZ
  "19101": { lat: 39.9540, lng: -75.1657 }, // Philadelphia, PA
  "78201": { lat: 29.4246, lng: -98.4951 }, // San Antonio, TX
  "92101": { lat: 32.7194, lng: -117.1629 }, // San Diego, CA
  "75201": { lat: 32.7815, lng: -96.7968 }, // Dallas, TX
  "95101": { lat: 37.3361, lng: -121.8906 }, // San Jose, CA
  "30301": { lat: 33.7490, lng: -84.3880 }, // Atlanta, GA
  "02101": { lat: 42.3554, lng: -71.0540 }, // Boston, MA
  "48201": { lat: 42.3314, lng: -83.0458 }, // Detroit, MI
  "98101": { lat: 47.6089, lng: -122.3354 }, // Seattle, WA
  "33101": { lat: 25.7781, lng: -80.1874 }, // Miami, FL
  "94102": { lat: 37.7797, lng: -122.4186 }, // San Francisco, CA
  "20001": { lat: 38.9101, lng: -77.0147 }, // Washington, DC
  "80201": { lat: 39.7533, lng: -104.9993 }, // Denver, CO
  "55401": { lat: 44.9764, lng: -93.2718 }, // Minneapolis, MN
  "32801": { lat: 28.5419, lng: -81.3761 }, // Orlando, FL
};

/**
 * Get coordinates for a zipcode
 * Returns placeholder coordinates if zipcode not found
 */
export function getCoordinatesForZipcode(zipcode: string): { lat: number; lng: number } {
  // Normalize zipcode (take first 5 digits)
  const normalizedZip = zipcode.slice(0, 5);
  
  // Check if we have exact match
  if (zipcodeCoordinates[normalizedZip]) {
    return zipcodeCoordinates[normalizedZip];
  }
  
  // Try to find a nearby zipcode (same first 3 digits)
  const prefix = normalizedZip.slice(0, 3);
  const nearbyZip = Object.keys(zipcodeCoordinates).find(zip => zip.startsWith(prefix));
  
  if (nearbyZip) {
    return zipcodeCoordinates[nearbyZip];
  }
  
  // Default to center of US (Kansas)
  return { lat: 39.0119, lng: -98.4842 };
}

/**
 * Calculate distance between two points using Haversine formula
 * Returns distance in miles
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 3959; // Earth's radius in miles
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
    Math.cos(toRadians(lat2)) *
    Math.sin(dLng / 2) *
    Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}