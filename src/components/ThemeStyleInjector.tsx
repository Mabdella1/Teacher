import React from 'react';
import { getPresetColors } from '../lib/theme';

interface ThemeStyleInjectorProps {
  primaryColor?: string;
}

export default function ThemeStyleInjector({ primaryColor }: ThemeStyleInjectorProps) {
  // If no primary color configured or is blue (default), we don't need any override
  if (!primaryColor || primaryColor === 'blue') {
    return null;
  }

  const colors = getPresetColors(primaryColor);
  const cssRules = Object.entries(colors)
    .map(([weight, hex]) => `--color-blue-${weight}: ${hex} !important;`)
    .join('\n');

  return (
    <style dangerouslySetInnerHTML={{ __html: `
      :root {
        ${cssRules}
      }
    `}} />
  );
}
