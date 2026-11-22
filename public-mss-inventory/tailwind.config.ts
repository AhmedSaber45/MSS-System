import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Cairo',
          'Segoe UI',
          'Tahoma',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Roboto',
          'Arial',
          'sans-serif',
        ],
        mono: [
          'JetBrains Mono',
          'Consolas',
          'Monaco',
          'Courier New',
          'monospace',
        ],
      },
      colors: {
        mss: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
          950: '#042f2e',
        },
      },
      boxShadow: {
        subtle: '0 1px 2px 0 rgba(15, 23, 42, 0.04)',
        modal: '0 8px 30px rgba(15, 23, 42, 0.12)',
        dropdown: '0 4px 16px rgba(15, 23, 42, 0.08)',
      },
    },
  },
  plugins: [],
};
export default config;
