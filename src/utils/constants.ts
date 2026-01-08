// App-wide constants
export const COLORS = {
    primary: '#4CAF50',
    primaryDark: '#388E3C',
    primaryLight: '#C8E6C9',
    secondary: '#FF9800',
    secondaryDark: '#F57C00',
    accent: '#2196F3',
    background: '#FAFAFA',
    surface: '#FFFFFF',
    error: '#F44336',
    text: '#212121',
    textSecondary: '#757575',
    textLight: '#BDBDBD',
    divider: '#E0E0E0',
    success: '#4CAF50',
    warning: '#FF9800',
    checked: '#9E9E9E',
};

export const SPACING = {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
};

export const FONT_SIZES = {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    xxxl: 32,
};

export const BORDER_RADIUS = {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    full: 999,
};

// List color options
export const LIST_COLORS = [
    '#4CAF50', // Green
    '#2196F3', // Blue
    '#FF9800', // Orange
    '#9C27B0', // Purple
    '#F44336', // Red
    '#00BCD4', // Cyan
    '#E91E63', // Pink
    '#795548', // Brown
];

// Units for quantities
export const QUANTITY_UNITS = [
    { value: '', label: '' },
    { value: 'lb', label: 'lb' },
    { value: 'oz', label: 'oz' },
    { value: 'kg', label: 'kg' },
    { value: 'g', label: 'g' },
    { value: 'pack', label: 'pack' },
    { value: 'box', label: 'box' },
    { value: 'bag', label: 'bag' },
    { value: 'bottle', label: 'bottle' },
    { value: 'can', label: 'can' },
    { value: 'jar', label: 'jar' },
    { value: 'bunch', label: 'bunch' },
    { value: 'dozen', label: 'dozen' },
    { value: 'piece', label: 'piece' },
    { value: 'gal', label: 'gal' },
    { value: 'qt', label: 'qt' },
    { value: 'pt', label: 'pt' },
    { value: 'cup', label: 'cup' },
];

// App configuration
export const APP_CONFIG = {
    maxFreeCollaborators: 3,
    maxRecentItems: 50,
    syncRetryLimit: 5,
    nearbyStoreRadius: 5000, // meters
};
