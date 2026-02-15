import React from 'react';
import { View, StyleSheet } from 'react-native';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
import { useUserStore } from '../../store/useUserStore';
import { COLORS, SPACING } from '../../utils/constants';

// Use TestIds.BANNER for development
const adUnitId = __DEV__ ? TestIds.BANNER : 'ca-app-pub-xxxxxxxxxxxxxxxx/yyyyyyyyyy';

export function AdBanner() {
    const { user } = useUserStore();

    if (user?.isPro) {
        return null;
    }

    return (
        <View style={styles.container}>
            <BannerAd
                unitId={adUnitId}
                size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
                requestOptions={{
                    requestNonPersonalizedAdsOnly: true,
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.background,
        paddingVertical: SPACING.xs,
        borderTopWidth: 1,
        borderTopColor: COLORS.divider,
    },
});
