import { Routes, Route, Navigate } from "react-router"
import LoginPage from "./pages/LoginPage"
import AppShell from "./pages/AppShell"

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/app" element={<AppShell />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
