/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'theme': {
          'bg-primary': 'var(--color-base03)',
          'bg-secondary': 'var(--color-base02)', 
          'bg-tertiary': 'var(--color-base01)',
          'bg-quaternary': 'var(--color-base00)',
          'text-primary': 'var(--color-base5)',
          'text-secondary': 'var(--color-base3)',
          'text-tertiary': 'var(--color-base1)',
          'text-muted': 'var(--color-base0)',
          'accent-primary': 'var(--color-blue)',
          'accent-secondary': 'var(--color-cyan)',
          'accent-blue': 'var(--color-blue)',
          'accent-cyan': 'var(--color-cyan)',
          'accent-green': 'var(--color-green)',
          'accent-yellow': 'var(--color-yellow)',
          'accent-orange': 'var(--color-orange)',
          'accent-red': 'var(--color-red)',
          'accent-magenta': 'var(--color-magenta)',
          'accent-violet': 'var(--color-violet)',
          'border-primary': 'var(--color-base01)',
          'border-secondary': 'var(--color-base00)',
        },
        'solarized': {
          'base03': 'var(--color-base03)',
          'base02': 'var(--color-base02)', 
          'base01': 'var(--color-base01)',
          'base00': 'var(--color-base00)',
          'base0': 'var(--color-base0)',
          'base1': 'var(--color-base1)',
          'base2': 'var(--color-base2)',
          'base3': 'var(--color-base3)',
          'base4': 'var(--color-base4)',
          'base5': 'var(--color-base5)',
          'blue': 'var(--color-blue)',
          'cyan': 'var(--color-cyan)',
          'green': 'var(--color-green)',
          'yellow': 'var(--color-yellow)',
          'orange': 'var(--color-orange)',
          'red': 'var(--color-red)',
          'magenta': 'var(--color-magenta)',
          'violet': 'var(--color-violet)',
          'green-hover': '#2C3300',
          'purple-hover': '#25285B'
        },
        'theme-palette': {
          'dark-1': '#00141A',
          'dark-2': '#002B36',
          'dark-3': '#073642',
          'dark-4': '#103956',
          'dark-5': '#103B3D',
          'accent-1': '#1A6265',
          'accent-2': '#1B6497',
          'accent-3': '#25285B',
          'accent-4': '#268BD2',
          'accent-5': '#29EEDF',
          'accent-6': '#2AA198',
          'accent-7': '#2C3300',
          'accent-8': '#332700',
          'accent-9': '#494FB6',
          'accent-10': '#49AEF5',
          'accent-11': '#541232',
          'accent-12': '#57100F',
          'accent-13': '#586E75',
          'accent-14': '#596600',
          'accent-15': '#5C220A',
          'accent-16': '#657B83',
          'accent-17': '#664D00',
          'accent-18': '#6C71C4',
          'accent-19': '#859900',
          'accent-20': '#9CA0ED',
          'accent-21': '#9EACAD',
          'accent-22': '#A13C11',
          'accent-23': '#AADCFF',
          'accent-24': '#ADB8B8',
          'accent-25': '#B02669',
          'accent-26': '#B58900',
          'accent-27': '#B7211F',
          'accent-28': '#B9FFFA',
          'accent-29': '#BAFB00',
          'accent-30': '#CB4B16',
          'accent-31': '#CCCFFF',
          'accent-32': '#D33682',
          'accent-33': '#D6FFAC',
          'accent-34': '#DC322F',
          'accent-35': '#EEE8D5',
          'accent-36': '#F255A1',
          'accent-37': '#F6524F',
          'accent-38': '#F8520E',
          'accent-39': '#FDF6E3',
          'accent-40': '#FF77B9',
          'accent-41': '#FF9468',
          'accent-42': '#FF9D9B',
          'accent-43': '#FFC100',
          'accent-44': '#FFE999',
          'accent-45': '#FFFFFF'
        }
      },
      fontFamily: {
        'sans': ['Inter', 'system-ui', 'sans-serif'],
        'mono': ['JetBrains Mono', 'Fira Code', 'Monaco', 'Consolas', 'monospace'],
      }
    },
  },
  plugins: [],
}