/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // (Pode adicionar sua 'fontFamily' aqui como antes)
      fontFamily: {
        'cyber': ['"Orbitron"', 'sans-serif'],
      },
      
      // ISSO É O MAIS IMPORTANTE:
      // As cores do Tailwind agora leem as variáveis CSS
      colors: {
        'primary': 'rgb(var(--color-primary) / <alpha-value>)',
        'secondary': 'rgb(var(--color-secondary) / <alpha-value>)',
        'accent': 'rgb(var(--color-accent) / <alpha-value>)',
        'warning': 'rgb(var(--color-warning) / <alpha-value>)',
        
        'text-base': 'rgb(var(--color-text-base) / <alpha-value>)',
        'text-header': 'rgb(var(--color-text-header) / <alpha-value>)',
        'text-muted': 'rgb(var(--color-text-muted) / <alpha-value>)',

        'bg-primary': 'rgb(var(--color-bg-primary) / <alpha-value>)',
        'bg-secondary': 'rgb(var(--color-bg-secondary) / <alpha-value>)',
        'bg-input': 'rgb(var(--color-bg-input) / <alpha-value>)',

        'border-color': 'rgb(var(--color-border) / <alpha-value>)',
        'border-accent': 'rgb(var(--color-border-accent) / <alpha-value>)',
      },
      
      // Efeitos de brilho (podem continuar os mesmos ou usar variáveis)
      boxShadow: {
        'glow-primary': '0 0 15px 5px rgb(var(--color-primary) / 0.3)',
        'glow-secondary': '0 0 15px 5px rgb(var(--color-secondary) / 0.3)',
        'glow-accent': '0 0 15px 5px rgb(var(--color-accent) / 0.3)',
        'glow-warning': '0 0 15px 5px rgb(var(--color-warning) / 0.3)',
      }
    },
  },
  plugins: [],
}