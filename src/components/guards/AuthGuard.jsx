import React from "react";
import { Navigate } from "react-router-dom";

import useAuth from "@/hooks/useAuth";

// For routes that can only be accessed by authenticated admin users
function AuthGuard({ children }) {
  const { isAuthenticated, isInitialized, isAdmin } = useAuth();

  if (isInitialized && !isAuthenticated) {
    return <Navigate to="/auth/sign-in" />;
  }

  if (isInitialized && isAuthenticated && !isAdmin) {
    return <Navigate to="/error/403" />;
  }

  return <React.Fragment>{children}</React.Fragment>;
}

export default AuthGuard;
