import { Link, NavLink } from "react-router-dom";
import logo from "../images/AI_Test_Assistant_logo.png";

export default function Header() {
  const baseLink =
    "px-3 py-2 rounded-md text-sm font-semibold transition";

  const navLinkClass = ({ isActive }) =>
    `${baseLink} ${
      isActive
        ? "bg-white text-blue-700"
        : "text-white hover:bg-blue-600"
    }`;

  return (
    <header className="bg-blue-700 h-14 flex items-center shadow-md">
      <div className="mx-auto max-w-6xl w-full px-4 flex items-center justify-between">

        {/* Logo (STRICT SIZE) */}
        <Link to="/" className="flex items-center">
          <img
            src={logo}
            alt="AI Test Assistant"
            className="h-14 max-h-14 w-auto object-contain"
          />
        </Link>

        {/* Navigation */}
        <nav className="flex items-center gap-2">
         <NavLink to="/" className={navLinkClass}>
    Home
  </NavLink>

  {/* Test Cases button */}
  <NavLink to="/testcases" className={navLinkClass}>
    Test Cases
  </NavLink>

  {/* About Us button */}
  <NavLink to="/about" className={navLinkClass}>
    About Us
  </NavLink>
        </nav>

      </div>
    </header>
  );
}
