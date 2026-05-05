/**
 * QTool Official Design Tokens (Baseline for Audit)
 * Derived from src/index.css
 */

export const DESIGN_TOKENS = {
  light: {
    colors: {
      primary: '#1E6DB7',
      primaryHover: '#175394',
      primarySoft: '#E0EEFF',
      background: '#F2F4F6',
      surface: '#FFFFFF',
      surfaceAlt: '#F4F6F9',
      border: '#B2BEC3',
      borderStrong: '#636E72',
      textPrimary: '#111827',
      textSecondary: '#2D3748',
      textMuted: '#4A5568',
      successBg: '#E8F4EB',
      warningBg: '#FFF4C6',
      dangerBg: '#FCE4E6',
      infoBg: '#E0EEFF',
      // Status Colors for Technician Tiles (Allowed specific exceptions)
      techStatus: {
        blue: '#3B82F6',
        orange: '#F97316',
        cyan: '#06B6D4',
        purple: '#A855F7',
        green: '#10B981'
      }
    },
    typography: {
      fontFamily: ['"Segoe UI"', 'Tahoma', 'Arial', 'sans-serif'],
      sizes: {
        pageTitle: '22px',
        moduleTitle: '18px',
        body: '15px',
        button: '14px',
        tableBody: '14px',
        secondary: '13px'
      }
    },
    shapes: {
      radius: '4px',
      radiusSm: '3px',
      radiusLg: '6px'
    }
  },
  dark: {
    colors: {
      primary: '#3B9EDA',
      primaryHover: '#2D8EC9',
      background: '#0F172A',
      surface: '#1E293B',
      border: 'rgba(255, 255, 255, 0.08)',
      textPrimary: '#E2E8F0',
      textSecondary: '#94A3B8',
      textMuted: '#64748B'
    }
  },
  // Shared / General Rules
  minTouchSize: 44,
  minDesktopSize: 36
};

// Helper to check if a color (RGB/HEX) matches an allowed set
export function isAllowedColor(color: string, allowedSet: string[]): boolean {
  // Simple normalization for basic audit
  const normalized = color.toLowerCase().replace(/\s/g, '');
  return allowedSet.some(allowed => allowed.toLowerCase().replace(/\s/g, '') === normalized);
}
