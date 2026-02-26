import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        income: {
          DEFAULT: "hsl(var(--income))",
          bg: "hsl(var(--income-bg))",
        },
        expense: {
          DEFAULT: "hsl(var(--expense))",
          bg: "hsl(var(--expense-bg))",
        },
        internal: {
          DEFAULT: "hsl(var(--internal))",
          bg: "hsl(var(--internal-bg))",
        },
        withdraw: {
          DEFAULT: "hsl(var(--withdraw))",
          bg: "hsl(var(--withdraw-bg))",
        },
        neutral: {
          DEFAULT: "hsl(var(--neutral))",
          bg: "hsl(var(--neutral-bg))",
        },
        "team-aaa": {
          DEFAULT: "hsl(var(--team-aaa))",
          bg: "hsl(var(--team-aaa-bg))",
        },
        "team-bbb": {
          DEFAULT: "hsl(var(--team-bbb))",
          bg: "hsl(var(--team-bbb-bg))",
        },
        "team-ccc": {
          DEFAULT: "hsl(var(--team-ccc))",
          bg: "hsl(var(--team-ccc-bg))",
        },
        "team-ddd": {
          DEFAULT: "hsl(var(--team-ddd))",
          bg: "hsl(var(--team-ddd-bg))",
        },
        "team-eee": {
          DEFAULT: "hsl(var(--team-eee))",
          bg: "hsl(var(--team-eee-bg))",
        },
        "team-csb": {
          DEFAULT: "hsl(var(--team-csb))",
          bg: "hsl(var(--team-csb-bg))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
        "highlight-blink": {
          "0%, 100%": { backgroundColor: "transparent" },
          "25%, 75%": { backgroundColor: "hsl(var(--primary) / 0.12)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "highlight-blink": "highlight-blink 1.2s ease-in-out forwards",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
