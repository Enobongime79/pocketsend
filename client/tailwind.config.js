/** Every colour is a CSS variable defined in src/index.css (light + dark).
 *  To re-theme the app, change the variables there, not the components. */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    // 900px is where the sidebar appears (see the design spec, section 6)
    screens: { sm: '640px', md: '900px', lg: '1280px' },
    extend: {
      colors: {
        bg: token('bg'),
        surface: token('surface'),
        raised: token('raised'),
        line: token('line'),
        'line-strong': token('line-strong'),
        ink: token('ink'),
        muted: token('muted'),
        subtle: token('subtle'),
        primary: token('primary'),
        success: token('success'),
        'success-soft': token('success-soft'),
        warning: token('warning'),
        'warning-soft': token('warning-soft'),
        danger: token('danger'),
        'danger-soft': token('danger-soft'),
        hero: token('hero'),
        'hero-line': token('hero-line'),
        account: token('account'),
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        mono: ['"Space Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
}
