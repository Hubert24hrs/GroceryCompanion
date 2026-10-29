import * as Location from 'expo-location';

export interface NearbyStore {
    id: string;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    distanceMeters: number;
    isOpen: boolean | null;
}

export class StoreSearchError extends Error {}

const GOOGLE_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;

export const storeProvider = GOOGLE_KEY ? 'Google Places' : 'OpenStreetMap';

export async function getCurrentPosition(): Promise<{ latitude: number; longitude: number }> {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') throw new StoreSearchError('Location permission is needed to find stores near you.');
    try {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
    } catch {
        throw new StoreSearchError("Couldn't get your location. Make sure location services are on.");
    }
}

export function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dφ = toRad(lat2 - lat1);
    const dλ = toRad(lon2 - lon1);
    const a = Math.sin(dφ / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dλ / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistance(meters: number, useMiles = true): string {
    if (!useMiles) return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;
    const miles = meters / 1609.34;
    return miles < 0.1 ? `${Math.round(meters * 3.281)} ft` : `${miles.toFixed(1)} mi`;
}

async function searchGoogle(lat: number, lng: number, radius: number): Promise<NearbyStore[]> {
    const res = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': GOOGLE_KEY!,
            'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.currentOpeningHours.openNow',
        },
        body: JSON.stringify({
            includedTypes: ['grocery_store', 'supermarket'],
            maxResultCount: 20,
            rankPreference: 'DISTANCE',
            locationRestriction: { circle: { center: { latitude: lat, longitude: lng }, radius } },
        }),
    });
    if (!res.ok) throw new StoreSearchError(`Store search failed (${res.status}).`);
    const body = await res.json();
    return (body.places ?? []).map((p: any) => ({
        id: p.id,
        name: p.displayName?.text ?? 'Store',
        address: p.formattedAddress ?? '',
        latitude: p.location.latitude,
        longitude: p.location.longitude,
        distanceMeters: distanceMeters(lat, lng, p.location.latitude, p.location.longitude),
        isOpen: p.currentOpeningHours?.openNow ?? null,
    }));
}

async function searchOpenStreetMap(lat: number, lng: number, radius: number): Promise<NearbyStore[]> {
    const filter = '["shop"~"^(supermarket|grocery|greengrocer|convenience|butcher|bakery|health_food)$"]';
    const query = `[out:json][timeout:20];(node${filter}(around:${radius},${lat},${lng});way${filter}(around:${radius},${lat},${lng}););out center 60;`;
    const res = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
    });
    if (!res.ok) throw new StoreSearchError(`Store search failed (${res.status}). Try again in a minute.`);
    const body = await res.json();
    return (body.elements ?? [])
        .filter((e: any) => e.tags?.name)
        .map((e: any) => {
            const latitude = e.lat ?? e.center?.lat;
            const longitude = e.lon ?? e.center?.lon;
            const t = e.tags;
            const address = [t['addr:housenumber'], t['addr:street'], t['addr:city']].filter(Boolean).join(' ');
            return {
                id: `osm-${e.type}-${e.id}`,
                name: t.name,
                address: address || (t.shop as string).replace('_', ' '),
                latitude,
                longitude,
                distanceMeters: distanceMeters(lat, lng, latitude, longitude),
                isOpen: null,
            };
        });
}

/** Real stores only: Google Places when a key is configured, OpenStreetMap otherwise. */
export async function findNearbyStores(lat: number, lng: number, radius = 5000): Promise<NearbyStore[]> {
    try {
        const stores = GOOGLE_KEY ? await searchGoogle(lat, lng, radius) : await searchOpenStreetMap(lat, lng, radius);
        return stores.sort((a, b) => a.distanceMeters - b.distanceMeters);
    } catch (e) {
        if (e instanceof StoreSearchError) throw e;
        throw new StoreSearchError("Couldn't reach the store directory. Check your connection.");
    }
}
