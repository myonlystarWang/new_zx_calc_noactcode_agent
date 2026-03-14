/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            animation: {
                'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                'glow': 'glow 3s ease-in-out infinite alternate',
            },
            keyframes: {
                glow: {
                    '0%': { transform: 'scale(1)', opacity: 0.5 },
                    '100%': { transform: 'scale(1.1)', opacity: 0.8 },
                }
            }
        },
    },
    plugins: [],
}
