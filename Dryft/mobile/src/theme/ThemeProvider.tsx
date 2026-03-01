import React, { createContext, useContext, useMemo, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { useAccessibilitySettings } from '../utils/accessibility';

// Color definitions
export interface ThemeColors {
  // Background
  background: string;
  backgroundSecondary: string;
  surface: string;
  surfaceElevated: string;

  // Primary
  primary: string;
  primaryLight: string;
  primaryDark: string;

  // Text
  text: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;

  // Status
  success: string;
  warning: string;
  error: string;
  info: string;

  // UI
  border: string;
  borderLight: string;
  divider: string;
  overlay: string;

  // Match colors
  like: string;
  superLike: string;
  pass: string;

  // Accent
  accent: string;
  accentSecondary: string;
  accentPink: string;
  accentYellow: string;

  // Extended text
  textTertiary: string;

  // Extended backgrounds
  backgroundDarkest: string;
  surfaceSecondary: string;

  // Safety
  panic: string;
  safetyWarning: string;
}

const PALETTE = {
  // Core dark palette
  background: '#0f0f23',
  backgroundSecondary: '#16213e',
  surface: '#1a1a2e',
  surfaceElevated: '#252542',
  primary: '#e94560',
  primaryLight: '#ff6b8a',
  primaryDark: '#c13050',
  text: '#ffffff',
  textSecondary: '#8892b0',
  textMuted: '#5c6580',
  success: '#2ecc71',
  warning: '#f39c12',
  error: '#e74c3c',
  info: '#3498db',
  border: '#2a2a4e',
  borderLight: '#3a3a5e',
  divider: '#1e1e38',
  overlay: 'rgba(0, 0, 0, 0.7)',
  accent: '#8B5CF6',
  accentSecondary: '#6B46C1',
  accentPink: '#EC4899',
  accentYellow: '#FCD34D',
  textTertiary: '#9CA3AF',
  backgroundDarkest: '#1a1a1a',
  surfaceSecondary: '#1F1F2E',
  panic: '#ff0000',
  safetyWarning: '#ff6b6b',

  // High-contrast palette
  black: '#000000',
  nearBlack: '#0a0a0a',
  darkSurface: '#1a1a1a',
  darkerSurface: '#2a2a2a',
  lightBorder: '#cccccc',
  lightText: '#e0e0e0',
  mutedLightText: '#b0b0b0',
  contrastSuccess: '#00ff00',
  contrastWarning: '#ffff00',
  contrastInfo: '#00ffff',
  contrastDivider: '#444444',
  contrastOverlay: 'rgba(0, 0, 0, 0.9)',
  contrastAccent: '#bb86fc',
  contrastAccentSecondary: '#9966cc',
  contrastAccentPink: '#ff69b4',
  contrastSurfaceSecondary: '#111111',

  // Color-blind-safe variants
  cbBlue: '#0077bb',
  cbBlueLight: '#33a1d8',
  cbBlueDark: '#005588',
  cbCyan: '#33bbee',
  cbAmber: '#ee9922',
  cbOrange: '#ee7733',
  cbTeal: '#009988',
  cbRed: '#cc3311',
  cbPink: '#ee3377',
  cbPinkLight: '#ff6699',
  cbPinkDark: '#cc1155',
} as const;

// Standard dark theme (default for Dryft)
export const DARK_THEME_COLORS: ThemeColors = {
  background: PALETTE.background,
  backgroundSecondary: PALETTE.backgroundSecondary,
  surface: PALETTE.surface,
  surfaceElevated: PALETTE.surfaceElevated,

  primary: PALETTE.primary,
  primaryLight: PALETTE.primaryLight,
  primaryDark: PALETTE.primaryDark,

  text: PALETTE.text,
  textSecondary: PALETTE.textSecondary,
  textMuted: PALETTE.textMuted,
  textInverse: PALETTE.background,

  success: PALETTE.success,
  warning: PALETTE.warning,
  error: PALETTE.error,
  info: PALETTE.info,

  border: PALETTE.border,
  borderLight: PALETTE.borderLight,
  divider: PALETTE.divider,
  overlay: PALETTE.overlay,

  like: PALETTE.success,
  superLike: PALETTE.info,
  pass: PALETTE.error,

  accent: PALETTE.accent,
  accentSecondary: PALETTE.accentSecondary,
  accentPink: PALETTE.accentPink,
  accentYellow: PALETTE.accentYellow,

  textTertiary: PALETTE.textTertiary,

  backgroundDarkest: PALETTE.backgroundDarkest,
  surfaceSecondary: PALETTE.surfaceSecondary,

  panic: PALETTE.panic,
  safetyWarning: PALETTE.safetyWarning,
};

// High contrast theme for accessibility
const highContrastTheme: ThemeColors = {
  background: PALETTE.black,
  backgroundSecondary: PALETTE.nearBlack,
  surface: PALETTE.darkSurface,
  surfaceElevated: PALETTE.darkerSurface,

  primary: PALETTE.text,
  primaryLight: PALETTE.text,
  primaryDark: PALETTE.lightBorder,

  text: PALETTE.text,
  textSecondary: PALETTE.lightText,
  textMuted: PALETTE.mutedLightText,
  textInverse: PALETTE.black,

  success: PALETTE.contrastSuccess,
  warning: PALETTE.contrastWarning,
  error: PALETTE.panic,
  info: PALETTE.contrastInfo,

  border: PALETTE.text,
  borderLight: PALETTE.lightBorder,
  divider: PALETTE.contrastDivider,
  overlay: PALETTE.contrastOverlay,

  like: PALETTE.contrastSuccess,
  superLike: PALETTE.contrastInfo,
  pass: PALETTE.panic,

  accent: PALETTE.contrastAccent,
  accentSecondary: PALETTE.contrastAccentSecondary,
  accentPink: PALETTE.contrastAccentPink,
  accentYellow: PALETTE.contrastWarning,

  textTertiary: PALETTE.lightBorder,

  backgroundDarkest: PALETTE.black,
  surfaceSecondary: PALETTE.contrastSurfaceSecondary,

  panic: PALETTE.panic,
  safetyWarning: PALETTE.contrastWarning,
};

// Color blind safe palettes
const protanopiaTheme: ThemeColors = {
  ...DARK_THEME_COLORS,
  // Replace red-based colors with blue-yellow alternatives
  primary: PALETTE.cbBlue,
  primaryLight: PALETTE.cbBlueLight,
  primaryDark: PALETTE.cbBlueDark,
  success: PALETTE.cbCyan,
  warning: PALETTE.cbAmber,
  error: PALETTE.cbOrange,
  like: PALETTE.cbCyan,
  superLike: PALETTE.cbTeal,
  pass: PALETTE.cbOrange,
  panic: PALETTE.cbOrange,
  safetyWarning: PALETTE.cbAmber,
};

const deuteranopiaTheme: ThemeColors = {
  ...DARK_THEME_COLORS,
  // Replace green-based colors with blue-yellow alternatives
  primary: PALETTE.cbBlue,
  primaryLight: PALETTE.cbBlueLight,
  primaryDark: PALETTE.cbBlueDark,
  success: PALETTE.cbCyan,
  warning: PALETTE.cbAmber,
  error: PALETTE.cbRed,
  like: PALETTE.cbCyan,
  superLike: PALETTE.cbBlue,
  pass: PALETTE.cbRed,
  panic: PALETTE.cbRed,
  safetyWarning: PALETTE.cbAmber,
};

const tritanopiaTheme: ThemeColors = {
  ...DARK_THEME_COLORS,
  // Replace blue-based colors with red-green alternatives
  primary: PALETTE.cbPink,
  primaryLight: PALETTE.cbPinkLight,
  primaryDark: PALETTE.cbPinkDark,
  success: PALETTE.cbTeal,
  warning: PALETTE.cbAmber,
  error: PALETTE.cbRed,
  info: PALETTE.cbTeal,
  like: PALETTE.cbTeal,
  superLike: PALETTE.cbPink,
  pass: PALETTE.cbRed,
  panic: PALETTE.cbRed,
  safetyWarning: PALETTE.cbAmber,
};

export type ColorBlindMode = 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia';

export interface Theme {
  colors: ThemeColors;
  isDark: boolean;
  isHighContrast: boolean;
  colorBlindMode: ColorBlindMode;
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    xxl: number;
  };
  borderRadius: {
    sm: number;
    md: number;
    lg: number;
    full: number;
  };
  typography: {
    fontSize: {
      xs: number;
      sm: number;
      md: number;
      lg: number;
      xl: number;
      xxl: number;
      xxxl: number;
    };
    fontWeight: {
      normal: '400';
      medium: '500';
      semibold: '600';
      bold: '700';
    };
  };
}

const baseTheme = {
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 16,
    full: 9999,
  },
  typography: {
    fontSize: {
      xs: 10,
      sm: 12,
      md: 14,
      lg: 16,
      xl: 20,
      xxl: 24,
      xxxl: 32,
    },
    fontWeight: {
      normal: '400' as const,
      medium: '500' as const,
      semibold: '600' as const,
      bold: '700' as const,
    },
  },
};

interface ThemeContextType {
  theme: Theme;
  colorBlindMode: ColorBlindMode;
  setColorBlindMode: (mode: ColorBlindMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const systemColorScheme = useColorScheme();
  const { settings, updateSetting } = useAccessibilitySettings();

  const colorBlindMode = settings.colorBlindMode as ColorBlindMode;
  const isHighContrast = settings.highContrast;

  const theme = useMemo((): Theme => {
    let colors: ThemeColors;

    if (isHighContrast) {
      colors = highContrastTheme;
    } else {
      switch (colorBlindMode) {
        case 'protanopia':
          colors = protanopiaTheme;
          break;
        case 'deuteranopia':
          colors = deuteranopiaTheme;
          break;
        case 'tritanopia':
          colors = tritanopiaTheme;
          break;
        default:
          colors = DARK_THEME_COLORS;
      }
    }

    return {
      colors,
      isDark: true,
      isHighContrast,
      colorBlindMode,
      ...baseTheme,
    };
  }, [colorBlindMode, isHighContrast]);

  const setColorBlindMode = (mode: ColorBlindMode) => {
    updateSetting('colorBlindMode', mode);
  };

  return (
    <ThemeContext.Provider value={{ theme, colorBlindMode, setColorBlindMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): Theme {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context.theme;
}

export function useThemeContext(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeContext must be used within a ThemeProvider');
  }
  return context;
}

// Utility hook for quick color access
export function useColors(): ThemeColors {
  const theme = useTheme();
  return theme.colors;
}

// Helper to apply color blind simulation for testing
export function simulateColorBlindness(
  color: string,
  mode: ColorBlindMode
): string {
  // This is a simplified simulation - real implementations
  // would use proper color matrices
  if (mode === 'none') return color;

  // Parse hex color
  const hex = color.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  let newR = r, newG = g, newB = b;

  switch (mode) {
    case 'protanopia':
      // Simulate red-blindness
      newR = Math.round(0.567 * r + 0.433 * g);
      newG = Math.round(0.558 * r + 0.442 * g);
      newB = Math.round(0.242 * g + 0.758 * b);
      break;
    case 'deuteranopia':
      // Simulate green-blindness
      newR = Math.round(0.625 * r + 0.375 * g);
      newG = Math.round(0.7 * r + 0.3 * g);
      newB = Math.round(0.3 * g + 0.7 * b);
      break;
    case 'tritanopia':
      // Simulate blue-blindness
      newR = Math.round(0.95 * r + 0.05 * g);
      newG = Math.round(0.433 * g + 0.567 * b);
      newB = Math.round(0.475 * g + 0.525 * b);
      break;
  }

  // Clamp values
  newR = Math.min(255, Math.max(0, newR));
  newG = Math.min(255, Math.max(0, newG));
  newB = Math.min(255, Math.max(0, newB));

  return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
}
