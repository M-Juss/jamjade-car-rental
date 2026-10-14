const plugin = require('tailwindcss/plugin');
const fontFamilies = require('./constants/font-families.json');
const layout = require('./constants/layout.json');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './forms/**/*.{js,jsx,ts,tsx}',
    './screens/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  corePlugins: {
    fontWeight: false,
  },
  theme: {
    extend: {
      spacing: {
        screen: `${layout.screenPadding}px`,
        card: `${layout.cardPadding}px`,
        section: `${layout.sectionGap}px`,
        control: `${layout.controlHeight}px`,
      },
      borderRadius: Object.fromEntries(
        Object.entries(layout.radius).map(([name, value]) => [name, `${value}px`]),
      ),
      fontSize: Object.fromEntries(
        Object.entries(layout.type).map(([name, [size, lineHeight]]) => [
          name,
          [`${size}px`, { lineHeight: `${lineHeight}px` }],
        ]),
      ),
      fontFamily: {
        sans: [fontFamilies.regular],
      },
      colors: {
        background: '#F8FAFF',
        border: '#DDE8FF',
        destructive: '#D92D20',
        'destructive-border': '#FECACA',
        'destructive-surface': '#FEF2F2',
        foreground: '#17315F',
        muted: '#EEF4FF',
        'muted-foreground': '#6C7A96',
        'secondary-foreground': '#53647F',
        primary: '#346EF6',
        'primary-hover': '#2558D8',
        'subtle-foreground': '#91A0B8',
        success: '#047857',
        'success-border': '#BBF7D0',
        'success-surface': '#ECFDF5',
        surface: '#FFFFFF',
        warning: '#806128',
        'warning-border': '#FFE7A6',
        'warning-surface': '#FFF9E8',
      },
    },
  },
  plugins: [
    plugin(({ addUtilities }) => {
      // Each static face is loaded separately for Expo Go and SDK 54.
      // Resolve weight classes to those faces without synthetic native weights.
      addUtilities(
        Object.fromEntries(
          Object.entries(fontFamilies).map(([weight, fontFamily]) => [
            `.font-${weight === 'regular' ? 'normal' : weight}`,
            { fontFamily, fontWeight: '400' },
          ]),
        ),
      );
    }),
  ],
};
