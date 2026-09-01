import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./tokens.css";
import { AuthProvider, RequireAuth } from "./lib/auth";
import FontScaleControl from "./components/FontScaleControl";
import Landing from "./pages/Landing/Landing";
import Profile from "./pages/Profile/Profile";
import Login from "./pages/Login/Login";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route
            path="/profile"
            element={
              <RequireAuth>
                <Profile />
              </RequireAuth>
            }
          />
        </Routes>
        <FontScaleControl />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
