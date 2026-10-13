import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./tokens.css";
import { AuthProvider, RequireAuth } from "./lib/auth";
import FontScaleControl from "./components/FontScaleControl";
import Landing from "./pages/Landing/Landing";
import Profile from "./pages/Profile/Profile";
import Energy from "./pages/Energy/Energy";
import Dashboard from "./pages/Dashboard/Dashboard";
import Reports from "./pages/Reports/Reports";
import Login from "./pages/Login/Login";
import ComingSoon from "./pages/ComingSoon/ComingSoon";
import Legal from "./pages/Legal/Legal";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/terms" element={<Legal kind="terms" />} />
          <Route path="/privacy" element={<Legal kind="privacy" />} />
          <Route
            path="/profile"
            element={
              <RequireAuth>
                <Profile />
              </RequireAuth>
            }
          />
          <Route
            path="/energy"
            element={
              <RequireAuth>
                <Energy />
              </RequireAuth>
            }
          />
          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <Dashboard />
              </RequireAuth>
            }
          />
          <Route
            path="/reports"
            element={
              <RequireAuth>
                <Reports />
              </RequireAuth>
            }
          />
          {(["water", "transportation", "digital", "waste", "benchmarking"] as const).map(
            (nav) => (
              <Route
                key={nav}
                path={`/${nav}`}
                element={
                  <RequireAuth>
                    <ComingSoon nav={nav} />
                  </RequireAuth>
                }
              />
            ),
          )}
        </Routes>
        <FontScaleControl />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
