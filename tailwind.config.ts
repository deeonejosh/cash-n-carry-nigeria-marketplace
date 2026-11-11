import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#ECFDF5',
          100: '#D1FAE5',
          200: '#A7F3D0',
          300: '#6EE7B7',
          400: '#34D399',
          500: '#10B981',
          600: '#059669',
          700: '#047857',
          800: '#065F46',
          900: '#064E3B',
        },
        orange: {
          500: '#F59E0B',
          600: '#EA580C',
        },
      },
      boxShadow: {
        soft: '0 20px 40px rgba(15, 23, 42, 0.08)',
      },
      backgroundImage: {
        hero: 'radial-gradient(circle at top left, rgba(16,185,129,0.18), transparent 30%), radial-gradient(circle at right, rgba(245,158,11,0.14), transparent 28%)',
      },
    },
  },
  plugins: [],
};

export default config;
