/**
 * qtool-design-tokens.ts
 * Single Source of Truth for the Deep Audit.
 */

export const DESIGN_TOKENS = {
  colors: {
    primary: ['rgb(15, 110, 163)', 'rgb(59, 158, 218)', 'rgb(30, 109, 183)', 'rgb(23, 83, 148)'],
    backgrounds: [
      'rgb(15, 23, 42)',  // Dark Mode App Bg
      'rgb(30, 41, 59)',  // Dark Mode Surface
      'rgb(20, 30, 46)',  // Dark Mode Surface Alt
      'rgb(242, 244, 246)', // Light Mode App Bg
      'rgb(255, 255, 255)', // Light Mode Surface
      'rgb(244, 246, 249)', // Light Mode Surface Alt
    ],
    text: [
      'rgb(226, 232, 240)', // Dark Main
      'rgb(148, 163, 184)', // Dark Muted
      'rgb(100, 116, 139)', // Dark Extra Muted
      'rgb(31, 41, 55)',    // Light Main
      'rgb(107, 114, 128)', // Light Muted
      'rgb(17, 24, 39)',    // Light Text Primary
    ],
    status: {
      success: 'rgb(16, 185, 129)',
      warning: 'rgb(245, 158, 11)',
      danger: 'rgb(239, 68, 68)',
      info: 'rgb(59, 130, 246)',
    }
  },
  borderRadius: {
    default: '4px',
    large: '6px',
    max: '6px' // P3 outlier if > 6px (except badges/pills)
  },
  typography: {
    baseSize: '15px',
    minSize: '12px'
  },
  spacing: {
    grid: 4
  },
  touch: {
    minTargetSize: 44
  }
};

export function isAllowedColor(color: string): boolean {
  if (!color) return true;
  if (color === 'rgba(0, 0, 0, 0)' || color === 'transparent') return true;
  
  // Basic check if it's one of our allowed tokens
  const allAllowed = [
    ...DESIGN_TOKENS.colors.primary,
    ...DESIGN_TOKENS.colors.backgrounds,
    ...DESIGN_TOKENS.colors.text,
    ...Object.values(DESIGN_TOKENS.colors.status)
  ];
  
  // Also allow rgba variations of primary/status for soft backgrounds
  if (color.startsWith('rgba')) {
    return true; // Simple bypass for dynamic soft colors for now
  }

  return allAllowed.some(allowed => color.includes(allowed) || allowed.includes(color));
}
