import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#e94560',
        secondary: '#1a1a2e',
        background: '#0f0f23',
        surface: '#1a1a2e',
        border: '#16213e',
        muted: '#8892b0',
      },
    },
  },
  plugins: [],
};

export default config;
