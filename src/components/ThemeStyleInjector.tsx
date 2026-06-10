import React from 'react';
import { getPresetColors } from '../lib/theme';

interface ThemeStyleInjectorProps {
  primaryColor?: string;
  fontFamily?: string;
}

export default function ThemeStyleInjector({ primaryColor, fontFamily }: ThemeStyleInjectorProps) {
  const activeTheme = primaryColor || 'blue';
  const colors = getPresetColors(activeTheme);
  const cssRules = Object.entries(colors)
    .map(([weight, hex]) => `--color-blue-${weight}: ${hex} !important;`)
    .join('\n');

  let fontStyleBlock = "";
  if (fontFamily) {
    let fontValue = "'Cairo', sans-serif";
    if (fontFamily === 'tajawal') fontValue = "'Tajawal', sans-serif";
    else if (fontFamily === 'almarai') fontValue = "'Almarai', sans-serif";
    else if (fontFamily === 'amiri') fontValue = "'Amiri', serif";
    else if (fontFamily === 'changa') fontValue = "'Changa', sans-serif";
    else if (fontFamily === 'reemkufi') fontValue = "'Reem Kufi', sans-serif";

    fontStyleBlock = `
      :root {
        --font-sans: ${fontValue} !important;
      }
      body, html, button, input, select, textarea, span, p, div, h1, h2, h3, h4, h5, h6, a, label {
        font-family: ${fontValue} !important;
      }
    `;
  }

  return (
    <style dangerouslySetInnerHTML={{ __html: `
      :root {
        ${cssRules}
      }
      ${fontStyleBlock}
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

