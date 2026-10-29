import { useColorScheme } from 'react-native';
import { usePrefs } from '../state/prefs';

// Design tokens. Herb green is the brand colour, carrot orange the accent.

export interface Palette {
    background: string;
    surface: string;
    surfaceAlt: string;
    border: string;
    text: string;
    textMuted: string;
    primary: string;
    onPrimary: string;
    primarySoft: string;
    accent: string;
    onAccent: string;
    accentSoft: string;
    danger: string;
    dangerSoft: string;
    warning: string;
    warningSoft: string;
    backdrop: string;
}

const light: Palette = {
    background: '#F5F6F1',
    surface: '#FFFFFF',
    surfaceAlt: '#EDF0E7',
    border: '#DCE2D5',
    text: '#1C2920',
    textMuted: '#5D6A61',
    primary: '#2E7D4B',
    onPrimary: '#FFFFFF',
    primarySoft: '#DFEFE3',
    accent: '#E2702A',
    onAccent: '#FFFFFF',
    accentSoft: '#FCE9DA',
    danger: '#C0392F',
    dangerSoft: '#F8E0DD',
    warning: '#A86A12',
    warningSoft: '#FBEFD6',
    backdrop: 'rgba(16, 24, 18, 0.45)',
};

const dark: Palette = {
    background: '#0F1410',
    surface: '#171F19',
    surfaceAlt: '#1F2922',
    border: '#2B372E',
    text: '#E6EDE7',
    textMuted: '#9AA79E',
    primary: '#5DBB7C',
    onPrimary: '#0C1A11',
    primarySoft: '#1D3325',
    accent: '#F08F4E',
    onAccent: '#1E1007',
    accentSoft: '#3A2517',
    danger: '#E8746B',
    dangerSoft: '#3A1D1A',
    warning: '#E0A54A',
    warningSoft: '#33270F',
    backdrop: 'rgba(0, 0, 0, 0.6)',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 18, pill: 999 } as const;

export const type = {
    title: { fontSize: 28, fontWeight: '800' as const, letterSpacing: -0.4 },
    heading: { fontSize: 20, fontWeight: '700' as const },
    subheading: { fontSize: 16, fontWeight: '700' as const },
    body: { fontSize: 16, fontWeight: '400' as const },
    label: { fontSize: 14, fontWeight: '600' as const },
    caption: { fontSize: 13, fontWeight: '400' as const },
};

export interface Theme {
    dark: boolean;
    colors: Palette;
}

export function useTheme(): Theme {
    const system = useColorScheme();
    const pref = usePrefs(s => s.prefs.theme);
    const isDark = pref === 'system' ? system === 'dark' : pref === 'dark';
    return { dark: isDark, colors: isDark ? dark : light };
}
