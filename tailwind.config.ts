import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        ink: '#0e1116',
        paper: '#f4f1ea',
        accent: '#d07a2d',
        muted: '#5f6b7a',
        success: '#1d9a5b',
        danger: '#c63b3b'
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'ui-sans-serif', 'system-ui'],
        body: ['"Instrument Serif"', 'ui-serif', 'Georgia']
      }
    }
  },
  plugins: []
};

export default config;

