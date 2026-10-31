import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Image, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Recipe } from '../../domain/types';
import { useTheme } from '../../ui/theme';

/** Ask Unsplash for a card-sized image instead of the ~2000px originals in the seed data. */
function sized(url: string): string {
    return /^https:\/\/images\.unsplash\.com\//.test(url) ? url.replace(/([?&])w=\d+/, '$1w=900') : url;
}

/** Recipe photo, or a tinted placeholder when there is none or it fails to load. */
export function RecipeImage({ recipe, style }: { recipe: Pick<Recipe, 'imageUrl' | 'title'>; style?: StyleProp<ViewStyle> }) {
    const { colors } = useTheme();
    const [failed, setFailed] = useState(false);
    const show = recipe.imageUrl && !failed;
    return (
        <View style={[styles.wrap, { backgroundColor: colors.primarySoft }, style]}>
            {show ? (
                <Image
                    source={{ uri: sized(recipe.imageUrl!) }}
                    style={StyleSheet.absoluteFill}
                    resizeMode="cover"
                    onError={() => setFailed(true)}
                    accessibilityIgnoresInvertColors
                    accessible={false}
                />
            ) : (
                <Ionicons name="restaurant-outline" size={32} color={colors.primary} />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
});
