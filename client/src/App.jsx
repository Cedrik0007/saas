import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { LoginPage } from "./pages/LoginPage.jsx";
import { SignupPage } from "./pages/SignupPage.jsx";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage.jsx";
import { ResetPasswordPage } from "./pages/ResetPasswordPage.jsx";
import { AppProvider } from "./context/AppContext.jsx";
import { ProtectedRoute } from "./components/ProtectedRoute.jsx";
import { PageLoader } from "./components/PageLoader.jsx";

// Lazy-loaded heavy pages (code splitting)
const AdminPage = lazy(() => import("./pages/AdminPage.jsx"));
const MemberPage = lazy(() => import("./pages/MemberPage.jsx").then((m) => ({ default: m.MemberPage })));
const ServerPage = lazy(() => import("./pages/ServerPage.jsx").then((m) => ({ default: m.ServerPage })));

function App() {
  return (
    <AppProvider>
      <BrowserRouter
        future={{
          v7_relativeSplatPath: true,
          v7_startTransition: true,
        }}
      >
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <Suspense fallback={<PageLoader message="Loading dashboard…" />}>
                  <AdminPage />
                </Suspense>
              </ProtectedRoute>
            }
          />
          <Route
            path="/member"
            element={
              <ProtectedRoute>
                <Suspense fallback={<PageLoader message="Loading member details…" />}>
                  <MemberPage />
                </Suspense>
              </ProtectedRoute>
            }
          />
          <Route
            path="/server"
            element={
              <Suspense fallback={<PageLoader message="Loading…" />}>
                <ServerPage />
              </Suspense>
            }
          />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}

export default App;
console.log("DUMMY DEPLOY TEST - v1");
  





