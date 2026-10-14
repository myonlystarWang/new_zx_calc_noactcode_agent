/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['"Noto Sans SC"', '-apple-system', 'BlinkMacSystemFont', '"PingFang SC"', '"Hiragino Sans GB"', '"Microsoft YaHei"', '"Segoe UI"', 'system-ui', 'Roboto', 'sans-serif'],
                serif: ['"Noto Serif SC"', '"Source Han Serif SC"', 'SimSun', 'serif'],
                'serif-sc': ['"Noto Serif SC"', '"Source Han Serif SC"', 'SimSun', 'serif'],
            },

            colors: {
                slate: {
                    350: '#b0bccd',
                    450: '#7c8ca2',
                    850: '#172033',
                },
                red: {
                    350: '#fa8b8b',
                },
            },
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
