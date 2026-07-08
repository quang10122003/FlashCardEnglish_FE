import { Spin } from "antd";
import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../utils/AuthContext";

export default function RequireAuth() {
  const location = useLocation();
  const { ensureAuthenticated } = useAuth();
  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    let active = true;

    const checkAuth = async () => {
      const token = localStorage.getItem("accessToken");
      if (!token) {
        if (active) {
          setAuthorized(false);
          setChecking(false);
        }
        return;
      }

      const ok = await ensureAuthenticated();
      if (!active) return;
      setAuthorized(ok);
      setChecking(false);
    };

    checkAuth();

    return () => {
      active = false;
    };
  }, [ensureAuthenticated, location.pathname]);

  if (checking) {
    return (
      <div style={{ minHeight: "50vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!authorized) {
    return <Navigate to="/Login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}