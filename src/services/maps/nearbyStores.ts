import * as Location from 'expo-location';
import { Store } from '../../types';

// Note: In production, use your actual Google Maps API key
const GOOGLE_MAPS_API_KEY = 'YOUR_GOOGLE_MAPS_API_KEY';

export interface LocationCoords {
    latitude: number;
    longitude: number;
}

/**
 * Request location permission from the user
 */
export async function requestLocationPermission(): Promise<boolean> {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
}

/**
 * Get the current device location
 */
export async function getCurrentLocation(): Promise<LocationCoords | null> {
    try {
        const hasPermission = await requestLocationPermission();
        if (!hasPermission) return null;

        const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
        });

        return {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
        };
    } catch (error) {
        console.error('Error getting location:', error);
        return null;
    }
}

/**
 * Find nearby grocery stores using Google Places API
 */
export async function findNearbyGroceryStores(
    latitude: number,
    longitude: number,
    radiusMeters: number = 5000
): Promise<Store[]> {
    try {
        // Using Google Places Nearby Search API
        const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?` +
            `location=${latitude},${longitude}` +
            `&radius=${radiusMeters}` +
            `&type=grocery_or_supermarket` +
            `&key=${GOOGLE_MAPS_API_KEY}`;

        const response = await fetch(url);
        const data = await response.json();

        if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
            console.error('Places API error:', data.status);
            return getMockStores(latitude, longitude);
        }

        if (!data.results || data.results.length === 0) {
            return [];
        }

        return data.results.map((place: any) => ({
            id: place.place_id,
            name: place.name,
            address: place.vicinity || place.formatted_address || '',
            location: {
                lat: place.geometry.location.lat,
                lng: place.geometry.location.lng,
            },
            isOpen: place.opening_hours?.open_now,
        }));
    } catch (error) {
        console.error('Error fetching nearby stores:', error);
        // Return mock data for development
        return getMockStores(latitude, longitude);
    }
}

/**
 * Calculate distance between two coordinates in meters
 */
export function calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

/**
 * Format distance for display
 */
export function formatDistance(meters: number): string {
    if (meters < 1000) {
        return `${Math.round(meters)} m`;
    }
    const miles = meters / 1609.34;
    return `${miles.toFixed(1)} mi`;
}

/**
 * Mock stores for development/demo purposes
 */
function getMockStores(latitude: number, longitude: number): Store[] {
    return [
        {
            id: 'mock-1',
            name: 'Kroger',
            address: '123 Main Street',
            location: { lat: latitude + 0.01, lng: longitude + 0.01 },
            isOpen: true,
        },
        {
            id: 'mock-2',
            name: 'Whole Foods Market',
            address: '456 Oak Avenue',
            location: { lat: latitude - 0.008, lng: longitude + 0.015 },
            isOpen: true,
        },
        {
            id: 'mock-3',
            name: 'Trader Joe\'s',
            address: '789 Elm Boulevard',
            location: { lat: latitude + 0.005, lng: longitude - 0.012 },
            isOpen: false,
        },
        {
            id: 'mock-4',
            name: 'Walmart Supercenter',
            address: '321 Commerce Drive',
            location: { lat: latitude - 0.02, lng: longitude - 0.005 },
            isOpen: true,
        },
        {
            id: 'mock-5',
            name: 'Target',
            address: '555 Shopping Center Lane',
            location: { lat: latitude + 0.015, lng: longitude - 0.008 },
            isOpen: true,
        },
    ];
}
