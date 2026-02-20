import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { ChatProvider } from './contexts/ChatContext';
import { EmoteProvider } from './contexts/EmoteContext';
import { useAuth } from './hooks/useAuth';
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { AuthCallback } from './pages/AuthCallback';
import { Chat } from './pages/Chat';
import { Onboarding } from './pages/Onboarding';
import { Profile } from './pages/Profile';
import { Stats } from './pages/Stats';
import { Members } from './pages/Members';
import { Privacy } from './pages/Privacy';

function AppRoutes() {
  const { user } = useAuth();
  
  return (
    <ChatProvider userId={user?.id}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/login" element={<Login />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route
            path="/chat"
            element={
              <ProtectedRoute>
                <Chat />
              </ProtectedRoute>
            }
          />
          <Route
            path="/onboarding"
            element={
              <ProtectedRoute>
                <Onboarding />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/stats"
            element={
              <ProtectedRoute>
                <Stats />
              </ProtectedRoute>
            }
          />
          <Route
            path="/members"
            element={
              <ProtectedRoute>
                <Members />
              </ProtectedRoute>
            }
          />
        </Route>
      </Routes>
    </ChatProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <EmoteProvider>
        <AppRoutes />
      </EmoteProvider>
    </BrowserRouter>
  );
}
