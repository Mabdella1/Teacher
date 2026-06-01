import React from 'react';
import { getPresetColors } from '../lib/theme';

interface ThemeStyleInjectorProps {
  primaryColor?: string;
}

export default function ThemeStyleInjector({ primaryColor }: ThemeStyleInjectorProps) {
  const activeTheme = primaryColor || 'blue';
  const colors = getPresetColors(activeTheme);
  const cssRules = Object.entries(colors)
    .map(([weight, hex]) => `--color-blue-${weight}: ${hex} !important;`)
    .join('\n');

  return (
    <style dangerouslySetInnerHTML={{ __html: `
      :root {
        ${cssRules}
      }
      .bg-primary-gradient {
        background-image: linear-gradient(135deg, var(--color-blue-600) 0%, var(--color-blue-650) 50%, var(--color-blue-800) 100%) !important;
      }
      .bg-blue-600 {
        background-image: linear-gradient(135deg, var(--color-blue-600) 0%, var(--color-blue-700) 100%) !important;
        border-color: transparent !important;
      }
      .bg-blue-600:hover {
        background-image: linear-gradient(135deg, var(--color-blue-650) 0%, var(--color-blue-750) 100%) !important;
      }
      .text-primary-gradient {
        background-image: linear-gradient(135deg, var(--color-blue-600) 0%, var(--color-blue-800) 100%) !important;
        -webkit-background-clip: text !important;
        -webkit-text-fill-color: transparent !important;
      }
    `}} />
  );
}

