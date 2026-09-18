/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        luma: {
          bg: '#0d0f0e',
          card: '#161816',
          'card-hover': '#1c1e1c',
          'card-border': '#242724',
          sidebar: '#121412',
          'sidebar-border': '#1f221f',
          lime: '#d4f938',
          'lime-hover': '#e2ff54',
          'lime-dim': '#2d3810',
          purple: '#7b6ef6',
          'purple-glow': '#9487ff',
          'purple-dim': '#2a2642',
          'purple-subtle': '#201d33',
          amber: '#d9822b',
          'amber-dim': '#332014',
          cream: '#f3efe6',
          'cream-text': '#121312',
          text: '#f3f4f1',
          'text-muted': '#848982',
          'text-dim': '#565a54',
        }
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'Newsreader', 'Georgia', 'serif'],
        sans: ['"Plus Jakarta Sans"', 'Inter', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      borderRadius: {
        '2xl': '1.25rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        'lime-glow': '0 0 24px -4px rgba(212, 249, 56, 0.35)',
        'purple-glow': '0 0 28px -6px rgba(123, 110, 246, 0.35)',
      },
      screens: {
        'xs': '375px',
        'mobile-lg': '425px',
      },
    },
  },
  plugins: [],
}
