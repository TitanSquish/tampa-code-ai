import { useEffect, useState } from "react"
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router"
import LoginPage from "./pages/LoginPage"
import AppShell from "./pages/AppShell"
import { apiUrl } from "./lib/api"
import { applyTheme, readThemePreference } from "./lib/theme"

export default function App() {
  const navigate = useNavigate()
  const location = useLocation()
  const [authenticated, setAuthenticated] = useState<boolean | null>(null)

  useEffect(() => {
    applyTheme(readThemePreference())
  }, [])

  useEffect(() => {
    let cancelled = false
    async function loadSession() {
      try {
        const res = await fetch(apiUrl("/api/auth/session"), {
          method: "GET",
          credentials: "include",
        })
        const data = (await res.json()) as { authenticated?: boolean }
        if (!cancelled) {
          setAuthenticated(Boolean(data.authenticated))
        }
      } catch {
        if (!cancelled) {
          setAuthenticated(false)
        }
      }
    }
    void loadSession()
    return () => {
      cancelled = true
    }
  }, [])

  function handleAuthenticated() {
    setAuthenticated(true)
    navigate("/app", { replace: true })
  }

  function handleSignedOut() {
    setAuthenticated(false)
    navigate("/login", { replace: true })
  }

  if (authenticated === null) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-foreground">
        <p className="text-sm tracking-wide text-muted-foreground">Loading workspace...</p>
      </div>
    )
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={
          authenticated ? (
            <Navigate to="/app" replace />
          ) : (
            <LoginPage onAuthenticated={handleAuthenticated} />
          )
        }
      />
      <Route
        path="/app"
        element={
          authenticated ? (
            <AppShell onSignedOut={handleSignedOut} />
          ) : (
            <Navigate to="/login" replace state={{ from: location.pathname }} />
          )
        }
      />
      <Route
        path="*"
        element={<Navigate to={authenticated ? "/app" : "/login"} replace />}
      />
    </Routes>
  )
}
