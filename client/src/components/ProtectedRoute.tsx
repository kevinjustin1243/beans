import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { username, loading } = useAuth();

  if (loading) return null;
  if (!username) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
