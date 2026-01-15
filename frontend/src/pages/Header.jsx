import { Link, NavLink, useNavigate } from "react-router-dom";
import logo from "../images/AI_Test_Assistant_logo.png";

export default function Header() {
  const navigate = useNavigate();

  const isLoggedIn = Boolean(localStorage.getItem("token"));
  const activeProjectId = localStorage.getItem("active_project_id");

  const baseLink =
    "px-3 py-2 rounded-md text-sm font-semibold transition whitespace-nowrap";

  const navLinkClass = ({ isActive }) =>
    `${baseLink} ${
      isActive
        ? "bg-white text-blue-700"
        : "text-white hover:bg-blue-600"
    }`;

  function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("token_expires_at");
    localStorage.removeItem("active_project_id");
    navigate("/login");
  }

  return (
    <header className="bg-blue-700 h-14 flex items-center shadow-md">
      <div className="mx-auto max-w-6xl w-full px-4 flex items-center justify-between">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <img
            src={logo}
            alt="AI Test Assistant"
            className="h-12 w-auto object-contain"
          />
        </Link>

        {/* Navigation */}
        <nav className="flex items-center gap-2">
          <NavLink to="/" className={navLinkClass}>
            Home
          </NavLink>

          <NavLink to="/about" className={navLinkClass}>
            About Us
          </NavLink>

          {/* Test Cases */}
          {isLoggedIn && (
            activeProjectId ? (
              <NavLink to="/testcases" className={navLinkClass}>
                Test Cases
              </NavLink>
            ) : (
              <span
                className={`${baseLink} cursor-not-allowed bg-blue-600 text-white/60`}
                title="Select a project first"
              >
                Test Cases
              </span>
            )
          )}

          {/* Login / Logout */}
          {isLoggedIn ? (
            <button
              onClick={handleLogout}
              className={`${baseLink} bg-red-500 text-white hover:bg-red-600`}
            >
              Logout
            </button>
          ) : (
            <NavLink
              to="/login"
              className={`${baseLink} bg-white text-blue-700 hover:bg-gray-100`}
            >
              Login
            </NavLink>
          )}
        </nav>
      </div>
    </header>
  );
}
