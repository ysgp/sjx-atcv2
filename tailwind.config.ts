import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        sjx: {
          gold: '#c5a059',
          dark: '#1a1a1a',
          gray: '#2d2d2d',
          gold_hover: '#b08d4a'
        }
      }
    },
  },
  plugins: [],
}
export default config