import { useEffect } from "react";
import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { useAuth } from "./lib/auth.jsx";
import { Loading } from "./components/common.jsx";
import AppShell from "./components/AppShell.jsx";
import { LoginPage, RegisterPage, ForgotPasswordPage, ResetPasswordPage, VerifyEmailPage, WelcomePage } from "./pages/AuthPages.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import ProjectsPage from "./pages/ProjectsPage.jsx";
import ProjectWorkspacePage from "./pages/ProjectWorkspacePage.jsx";
import TasksPage from "./pages/TasksPage.jsx";
import TaskDetailPage from "./pages/TaskDetailPage.jsx";
import NotesPage from "./pages/NotesPage.jsx";
import TeamPage from "./pages/TeamPage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";

function Protected() {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}

function GuestOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  return user ? <Navigate to="/dashboard" replace /> : children;
}

export default function App() {
  useEffect(() => {
    document.documentElement.dataset.theme = localStorage.getItem("taskforge-theme") || "light";
  }, []);
  return <Routes>
    <Route path="/" element={<><Outlet /></>}>
      <Route index element={<WelcomePage />} />
      <Route path="login" element={<GuestOnly><LoginPage /></GuestOnly>} />
      <Route path="register" element={<GuestOnly><RegisterPage /></GuestOnly>} />
      <Route path="forgot-password" element={<GuestOnly><ForgotPasswordPage /></GuestOnly>} />
      <Route path="reset-password/:token" element={<ResetPasswordPage />} />
      <Route path="verify-email" element={<VerifyEmailPage />} />
      <Route element={<Protected />}>
        <Route element={<AppShell />}>
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="projects/:projectId" element={<ProjectWorkspacePage />} />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="tasks/:projectId/:taskId" element={<TaskDetailPage />} />
          <Route path="notes" element={<NotesPage />} />
          <Route path="team" element={<TeamPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Route>
  </Routes>;
}
