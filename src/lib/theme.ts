export interface ColorPalette {
  '50': string;
  '100': string;
  '105': string;
  '150': string;
  '200': string;
  '300': string;
  '400': string;
  '500': string;
  '600': string;
  '650': string;
  '700': string;
  '750': string;
  '800': string;
  '900': string;
  '950': string;
}

export interface ColorPreset {
  id: string;
  name: string;
  colors: ColorPalette;
}

export const COLOR_PRESETS: ColorPreset[] = [
  {
    id: 'blue',
    name: 'الأزرق الملكي (الافتراضي)',
    colors: {
      '50': '#f0f9ff',
      '100': '#e0f2fe',
      '105': '#d5effe',
      '150': '#cee9fc',
      '200': '#bae6fd',
      '300': '#7dd3fc',
      '400': '#38bdf8',
      '500': '#0ea5e9',
      '600': '#2563eb',
      '650': '#1d58db',
      '700': '#1d4ed8',
      '750': '#1a45bf',
      '800': '#1e40af',
      '900': '#1e3a8a',
      '950': '#0f172a',
    }
  },
  {
    id: 'indigo',
    name: 'البنفسجي الهادئ (Indigo)',
    colors: {
      '50': '#f5f3ff',
      '100': '#ede9fe',
      '105': '#e5deff',
      '150': '#dfd5ff',
      '200': '#ddd6fe',
      '300': '#c4b5fd',
      '400': '#a78bfa',
      '500': '#8b5cf6',
      '600': '#4f46e5',
      '650': '#433bc9',
      '700': '#4338ca',
      '750': '#3d32b5',
      '800': '#3730a3',
      '900': '#312e81',
      '950': '#1e1b4b',
    }
  },
  {
    id: 'emerald',
    name: 'الأخضر الزمردي (Emerald)',
    colors: {
      '50': '#ecfdf5',
      '100': '#d1fae5',
      '105': '#c2f7da',
      '150': '#b4f2cf',
      '200': '#a7f3d0',
      '300': '#6ee7b7',
      '400': '#34d399',
      '500': '#10b981',
      '600': '#059669',
      '650': '#048059',
      '700': '#047857',
      '750': '#056b4e',
      '800': '#065f46',
      '900': '#064e3b',
      '950': '#022c22',
    }
  },
  {
    id: 'violet',
    name: 'الكرز والبنفسج العريق (Violet)',
    colors: {
      '50': '#faf5ff',
      '100': '#f3e8ff',
      '105': '#ebd5ff',
      '150': '#dfbdfe',
      '200': '#e9d5ff',
      '300': '#d8b4fe',
      '400': '#c084fc',
      '500': '#a855f7',
      '600': '#7c3aed',
      '650': '#6d2fe0',
      '700': '#6d28d9',
      '750': '#5f20c2',
      '800': '#5b21b6',
      '900': '#4c1d95',
      '950': '#2e1065',
    }
  },
  {
    id: 'orange',
    name: 'البرتقالي الدافئ (Orange)',
    colors: {
      '50': '#fff7ed',
      '100': '#ffedd5',
      '105': '#ffe3c2',
      '150': '#ffdcb0',
      '200': '#fed7aa',
      '300': '#fdba74',
      '400': '#fb923c',
      '500': '#f97316',
      '600': '#ea580c',
      '650': '#d64d08',
      '700': '#c2410c',
      '750': '#ae3709',
      '800': '#9a3412',
      '900': '#7c2d12',
      '950': '#431407',
    }
  },
  {
    id: 'rose',
    name: 'الوردي الروائي الأنيق (Rose)',
    colors: {
      '50': '#fff1f2',
      '100': '#ffe4e6',
      '105': '#ffd5d9',
      '150': '#ffcbd1',
      '200': '#fecdd3',
      '300': '#fda4af',
      '400': '#fb7185',
      '500': '#f43f5e',
      '600': '#e11d48',
      '650': '#cc143d',
      '700': '#be123c',
      '750': '#ac0d33',
      '800': '#9f1239',
      '900': '#881337',
      '950': '#4c0519',
    }
  },
  {
    id: 'teal',
    name: 'الفيروزي المنعش (Teal)',
    colors: {
      '50': '#f0fdfa',
      '100': '#ccfbf1',
      '105': '#b7f6ea',
      '150': '#a2eedf',
      '200': '#99f6e4',
      '300': '#5eead4',
      '400': '#2dd4bf',
      '500': '#14b8a6',
      '600': '#0d9488',
      '650': '#098277',
      '700': '#0f766e',
      '750': '#0e665f',
      '800': '#115e59',
      '900': '#134e4a',
      '950': '#042f2e',
    }
  },
  {
    id: 'amber',
    name: 'الذهبي الملكي (Amber)',
    colors: {
      '50': '#fffbeb',
      '100': '#fef3c7',
      '105': '#fdeca7',
      '150': '#fce386',
      '200': '#fde68a',
      '300': '#fcd34d',
      '400': '#fbbf24',
      '500': '#f59e0b',
      '600': '#d97706',
      '650': '#c46a04',
      '700': '#b45309',
      '750': '#a04805',
      '800': '#92400e',
      '900': '#78350f',
      '950': '#451a03',
    }
  }
];

export const getPresetColors = (id?: string): ColorPalette => {
  if (id && id.startsWith('#')) {
    return generatePaletteFromHex(id);
  }
  const preset = COLOR_PRESETS.find(p => p.id === id);
  return preset ? preset.colors : COLOR_PRESETS[0].colors;
};

// Converts HEX to HSL
function hexToHsl(hex: string): { h: number; s: number; l: number } {
  hex = hex.replace(/^#/, '');
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

// Converts HSL to HEX
function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;

  if (0 <= h && h < 60) {
    r = c;
    g = x;
    b = 0;
  } else if (60 <= h && h < 120) {
    r = x;
    g = c;
    b = 0;
  } else if (120 <= h && h < 180) {
    r = 0;
    g = c;
    b = x;
  } else if (180 <= h && h < 240) {
    r = 0;
    g = x;
    b = c;
  } else if (240 <= h && h < 300) {
    r = x;
    g = 0;
    b = c;
  } else if (300 <= h && h < 360) {
    r = c;
    g = 0;
    b = x;
  }

  const rStr = Math.round((r + m) * 255).toString(16).padStart(2, '0');
  const gStr = Math.round((g + m) * 255).toString(16).padStart(2, '0');
  const bStr = Math.round((b + m) * 255).toString(16).padStart(2, '0');

  return `#${rStr}${gStr}${bStr}`;
}

// Generates smooth CSS shaded palette from a single base custom hex color
export const generatePaletteFromHex = (hex: string): ColorPalette => {
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) {
    if (/^#[0-9A-Fa-f]{3}$/.test(hex)) {
      hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
    } else {
      hex = '#2563eb';
    }
  }

  const { h, s, l } = hexToHsl(hex);

  const getLightnessForWeight = (weight: string): number => {
    switch (weight) {
      case '50': return 98;
      case '100': return 95;
      case '105': return 91;
      case '150': return 87;
      case '200': return 82;
      case '300': return 72;
      case '400': return 60;
      case '500': return Math.min(l + 8, 92);
      case '600': return l; // the base custom color is exactly the 600 main value
      case '650': return l * 0.90;
      case '700': return l * 0.82;
      case '750': return l * 0.74;
      case '800': return l * 0.65;
      case '900': return l * 0.45;
      case '950': return Math.max(l * 0.20, 8);
      default: return l;
    }
  };

  const getSaturationForWeight = (weight: string): number => {
    switch (weight) {
      case '50': return Math.min(s, 25);
      case '100': return Math.min(s, 40);
      case '950': return Math.min(s, 35);
      default: return s;
    }
  };

  return {
    '50': hslToHex(h, getSaturationForWeight('50'), getLightnessForWeight('50')),
    '100': hslToHex(h, getSaturationForWeight('100'), getLightnessForWeight('100')),
    '105': hslToHex(h, getSaturationForWeight('105'), getLightnessForWeight('105')),
    '150': hslToHex(h, getSaturationForWeight('150'), getLightnessForWeight('150')),
    '200': hslToHex(h, getSaturationForWeight('200'), getLightnessForWeight('200')),
    '300': hslToHex(h, getSaturationForWeight('300'), getLightnessForWeight('300')),
    '400': hslToHex(h, getSaturationForWeight('400'), getLightnessForWeight('400')),
    '500': hslToHex(h, getSaturationForWeight('500'), getLightnessForWeight('500')),
    '600': hex,
    '650': hslToHex(h, getSaturationForWeight('650'), getLightnessForWeight('650')),
    '700': hslToHex(h, getSaturationForWeight('700'), getLightnessForWeight('700')),
    '750': hslToHex(h, getSaturationForWeight('750'), getLightnessForWeight('750')),
    '800': hslToHex(h, getSaturationForWeight('800'), getLightnessForWeight('800')),
    '900': hslToHex(h, getSaturationForWeight('900'), getLightnessForWeight('900')),
    '950': hslToHex(h, getSaturationForWeight('950'), getLightnessForWeight('950')),
  };
};
