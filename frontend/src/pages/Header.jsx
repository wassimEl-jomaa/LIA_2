import { Link, NavLink, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import logo from "../images/AI_Test_Assistant_logo.png";

function isProbablyExpired(expiresAt) {
  if (!expiresAt) return false;
  const t = Date.parse(expiresAt);
  if (Number.isNaN(t)) return false;
  return t <= Date.now();
}

export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();

  // ✅ keep auth state reactive (not stuck on initial localStorage)
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeProjectId, setActiveProjectId] = useState(null);

  // Update state when route changes (simple + reliable)
  useEffect(() => {
    const token = localStorage.getItem("token");
    const expiresAt = localStorage.getItem("token_expires_at");
    const projectId = localStorage.getItem("active_project_id");

    // ✅ security: auto-clear expired token
    if (token && isProbablyExpired(expiresAt)) {
      localStorage.removeItem("token");
      localStorage.removeItem("token_expires_at");
    }

    setIsLoggedIn(Boolean(localStorage.getItem("token")));
    setActiveProjectId(projectId);
  }, [location.pathname]);

  const baseLink =
    "px-3 py-2 rounded-lg text-sm font-semibold transition whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-white/40";

  const navLinkClass = ({ isActive }) =>
    `${baseLink} ${
      isActive
        ? "bg-white/15 text-white"
        : "text-white/90 hover:bg-white/10 hover:text-white"
    }`;

  const pill =
    "inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/90";

  function handleLogout() {
    // Optional: call backend logout endpoint if you have it
    // await fetch(`${API_BASE}/auth/logout`, { method: "POST", headers: { Authorization: `Bearer ${token}` } })

    localStorage.removeItem("token");
    localStorage.removeItem("token_expires_at");
    localStorage.removeItem("active_project_id");
    setIsLoggedIn(false);
    setActiveProjectId(null);

    navigate("/login", { replace: true });
  }

  const testCasesDisabled = useMemo(() => isLoggedIn && !activeProjectId, [isLoggedIn, activeProjectId]);

  return (
    <header className="sticky top-0 z-50 border-b border-blue-800/30 bg-gradient-to-r from-blue-800 to-blue-700 shadow">
      <div className="mx-auto max-w-6xl px-4">
        <div className="h-14 flex items-center justify-between gap-3">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 min-w-[140px]">
            <img
              src={logo}
              alt="AI Test Assistant"
              className="h-10 w-auto object-contain"
            />
            <span className="hidden sm:block text-white font-bold tracking-tight">
              AI Test Assistant
            </span>
          </Link>

          {/* Center nav */}
          <nav className="flex items-center gap-2 overflow-x-auto">
            <NavLink to="/" className={navLinkClass}>
              Home
            </NavLink>

            {isLoggedIn && (
              <NavLink to="/projects" className={navLinkClass}>
                My Projects
              </NavLink>
            )}

            <NavLink to="/about" className={navLinkClass}>
              About
            </NavLink>

            {/* Test Cases (requires selected project) */}
            {isLoggedIn && (
              testCasesDisabled ? (
                <button
                  type="button"
                  onClick={() => navigate("/projects")}
                  className={`${baseLink} bg-white/10 text-white/70 hover:bg-white/15`}
                  title="Select a project first (go to My Projects)"
                >
                  Test Cases
                </button>
              ) : (
                <NavLink to="/testcases" className={navLinkClass}>
                  Test Cases
                </NavLink>
              )
            )}
          </nav>

          {/* Right side actions */}
          <div className="flex items-center gap-2">
            {isLoggedIn && (
              <span className={`${pill} hidden md:inline-flex`} title="Active project id">
                Project: <span className="ml-1 text-white">{activeProjectId || "—"}</span>
              </span>
            )}

            {isLoggedIn ? (
              <button
                onClick={handleLogout}
                className={`${baseLink} bg-red-500/95 text-white hover:bg-red-600`}
              >
                Logout
              </button>
            ) : (
              <NavLink
                to="/login"
                className={`${baseLink} bg-white text-blue-800 hover:bg-white/90`}
              >
                Login
              </NavLink>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
