import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";

const API_BASE = "http://127.0.0.1:8000";

function isProbablyExpired(expiresAt) {
  if (!expiresAt) return false;
  const t = Date.parse(expiresAt);
  if (Number.isNaN(t)) return false;
  return t <= Date.now();
}

export default function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("demo@lia.se"); // ok to prefill email
  const [password, setPassword] = useState("");      // ✅ don't prefill password
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [capsLockOn, setCapsLockOn] = useState(false);

  // ✅ If already logged in (and token not expired), go directly to My Projects
  useEffect(() => {
    const token = localStorage.getItem("token");
    const expiresAt = localStorage.getItem("token_expires_at");
    if (token && !isProbablyExpired(expiresAt)) {
      navigate("/projects");
    } else if (token && isProbablyExpired(expiresAt)) {
      // cleanup stale token
      localStorage.removeItem("token");
      localStorage.removeItem("token_expires_at");
    }
  }, [navigate]);

  const canSubmit = useMemo(() => {
    const e = email.trim();
    return e.length > 3 && e.includes("@") && password.length >= 1 && !loading;
  }, [email, password, loading]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const cleanEmail = email.trim().toLowerCase();

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);

      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // optional: include credentials only if you ever switch to cookies-based auth
        // credentials: "include",
        body: JSON.stringify({ email: cleanEmail, password }),
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        // ✅ security: generic message for auth issues (don’t leak if email exists)
        const msg =
          res.status === 401 || res.status === 403
            ? "Invalid email or password."
            : data?.detail || "Login failed.";
        throw new Error(msg);
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("token_expires_at", data.expires_at);

      // ✅ Redirect to My Projects
      navigate("/projects");
    } catch (err) {
      setPassword(""); // ✅ clear password after a failed attempt
      setError(
        err?.name === "AbortError"
          ? "Request timed out. Please try again."
          : err?.message || "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-56px)] bg-gray-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow border border-gray-100 p-6">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-gray-900">Welcome back</h1>
            <p className="text-sm text-gray-600">
              Log in to access your projects and generate test cases.
            </p>
          </div>

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {/* Email */}
            <div>
              <label className="block text-sm font-semibold text-gray-700">
                Email
              </label>
              <input
                type="email"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2
                           focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                inputMode="email"
                required
              />
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between">
                <label className="block text-sm font-semibold text-gray-700">
                  Password
                </label>

                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="text-sm font-semibold text-blue-700 hover:underline"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>

              <input
                type={showPassword ? "text" : "password"}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2
                           focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyUp={(e) => setCapsLockOn(e.getModifierState?.("CapsLock") || false)}
                autoComplete="current-password"
                required
              />

              {capsLockOn && (
                <div className="mt-2 text-xs text-amber-700">
                  Caps Lock is ON
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full rounded-lg bg-blue-700 px-4 py-2.5 text-white font-semibold
                         hover:bg-blue-800 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? "Signing in..." : "Login"}
            </button>
          </form>

          <div className="mt-5 flex items-center justify-between text-sm">
            <div className="text-gray-600">
              Don’t have an account?{" "}
              <Link to="/register" className="text-blue-700 font-semibold hover:underline">
                Register
              </Link>
            </div>

            {/* Optional: add later if you build endpoint */}
            {/* <Link to="/forgot-password" className="text-blue-700 font-semibold hover:underline">
              Forgot password?
            </Link> */}
          </div>

          <div className="mt-4 text-xs text-gray-400">
            Backend: {API_BASE}
          </div>
        </div>

        {/* Small footer */}
        <div className="mt-4 text-center text-xs text-gray-400">
          Tip: Use a strong password and don’t share your token.
        </div>
      </div>
    </div>
  );
}
