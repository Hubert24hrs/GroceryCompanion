import { httpsCallable } from 'firebase/functions';
import { DeliveryProvider, DeliveryRequest, providerFor } from '../domain/delivery';
import { DELIVERY_COUNTRIES, DELIVERY_MODE } from '../domain/entitlements';
import { functions } from './firebase';

export const MOCK_DELIVERY_URL = 'https://example.com/mock-instacart-shopping-list';

const instacart: DeliveryProvider = {
    id: 'instacart',
    label: 'Shop on Instacart',
    supportedCountries: DELIVERY_COUNTRIES,
    async buildShoppingLink(request: DeliveryRequest) {
        // MOCK for development: EXPO_PUBLIC_DELIVERY_MODE=mock never reaches Instacart.
        if (DELIVERY_MODE === 'mock') return MOCK_DELIVERY_URL;
        if (!functions) throw new Error('Accounts are not configured for this build.');
        const { data } = await httpsCallable<DeliveryRequest, { url: string }>(functions, 'createDeliveryLink')(request);
        return data.url;
    },
};

export const deliveryProviderFor = (country: string | null) => providerFor([instacart], DELIVERY_MODE, country);
