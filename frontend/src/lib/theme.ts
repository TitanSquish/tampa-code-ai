export type Theme = "light" | "dark"

const THEME_KEY = "permitiq-theme"

export function readThemePreference(): Theme {
  if (typeof window === "undefined") {
    return "light"
  }
  const stored = window.localStorage.getItem(THEME_KEY)
  if (stored === "light" || stored === "dark") {
    return stored
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light"
}

export function applyTheme(theme: Theme) {
  if (typeof document === "undefined") {
    return
  }
  const root = document.documentElement
  root.classList.toggle("dark", theme === "dark")
  root.dataset.theme = theme
}

export function saveThemePreference(theme: Theme) {
  if (typeof window === "undefined") {
    return
  }
  window.localStorage.setItem(THEME_KEY, theme)
}
