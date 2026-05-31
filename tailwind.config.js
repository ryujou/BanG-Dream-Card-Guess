/** @type {import('tailwindcss').Config} */
export default {
  // Disable preflight to avoid resetting existing project styles
  corePlugins: {
    preflight: false,
  },
  content: ['./index.html', './src/client/**/*.{vue,js,ts}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fff0f3',
          100: '#ffe0e6',
          500: '#ff3d6e',
          600: '#e02f5a',
          700: '#c0264d',
        },
      },
    },
  },
  plugins: [],
}
