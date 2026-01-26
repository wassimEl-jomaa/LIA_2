// ...existing code...
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

// SECURITY NOTE:
// Prefer HTTPS in production. Also prefer HttpOnly + Secure cookies for auth tokens
// (so you do NOT store tokens in localStorage/sessionStorage at all).
const API_BASE =
  (import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000").replace(/\/$/, "");

// If you *must* support token-in-response for legacy reasons, keep it in-memory (best)
// or sessionStorage (better than localStorage). localStorage is easiest to steal via XSS.
const ALLOW_TOKEN_STORAGE = false;

function validateEmail(e) {
  // Simple + pragmatic; backend must enforce real validation.
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(e);
}

function passwordMeetsCriteria(pw) {
  // 12+ recommended; require letter+number; allow specials.
  return /^(?=.*[A-Za-z])(?=.*\d).{12,}$/.test(pw);
}

function sanitizeText(value) {
  // Client-side trimming only (do NOT pretend this is security).
  // Backend must validate and sanitize.
  return (value ?? "").toString().trim();
}

function isSafePositiveIntString(v) {
  if (v === "" || v == null) return true;
  return /^[1-9]\d*$/.test(String(v));
}

export default function Register() {
  const navigate = useNavigate();
  const abortRef = useRef(null);
  const timeoutRef = useRef(null);
  const errorRef = useRef(null);

  // Basic auth
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

  // User info
  const [name, setName] = useState("");
  const [tel, setTel] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");

  // IMPORTANT SECURITY CHANGE:
  // Do not allow choosing role during public registration.
  // Backend should assign role (e.g., "Tester") and only allow elevated roles via admin flow.
  const roleId = 2; // fixed to Tester
  const [organizationId, setOrganizationId] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // If you rely on HttpOnly cookies, you can only detect "logged in" via an API call.
    // This local check is optional/legacy.
    const token = sessionStorage.getItem("token") || localStorage.getItem("token");
    if (token) navigate("/");
  }, [navigate]);

  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const emailTrim = useMemo(() => sanitizeText(email), [email]);
  const nameTrim = useMemo(() => sanitizeText(name), [name]);
  const countryTrim = useMemo(() => sanitizeText(country), [country]);
  const cityTrim = useMemo(() => sanitizeText(city), [city]);
  const addressTrim = useMemo(() => sanitizeText(address), [address]);
  const telTrim = useMemo(() => sanitizeText(tel), [tel]);

  const passwordValid = useMemo(() => passwordMeetsCriteria(password), [password]);
  const emailValid = useMemo(() => validateEmail(emailTrim), [emailTrim]);
  const orgIdValid = useMemo(
    () => isSafePositiveIntString(organizationId),
    [organizationId]
  );

  const canSubmit =
    !loading &&
    emailValid &&
    passwordValid &&
    password === confirmPassword &&
    orgIdValid;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    // Abort any in-flight request
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    // Basic client-side validation (backend must also validate)
    if (!emailValid) {
      setError("Please enter a valid email address.");
      queueMicrotask(() => errorRef.current?.focus());
      return;
    }
    if (!passwordValid) {
      setError("Password must be at least 12 characters and include letters and numbers.");
      queueMicrotask(() => errorRef.current?.focus());
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      queueMicrotask(() => errorRef.current?.focus());
      return;
    }
    if (!orgIdValid) {
      setError("Organization ID must be a positive integer (or left blank).");
      queueMicrotask(() => errorRef.current?.focus());
      return;
    }

    setLoading(true);

    // Timeout for hanging requests (security/UX)
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      abortRef.current?.abort();
    }, 15000);

    try {
      // Avoid sending empty strings
      const payload = {
        email: emailTrim,
        password, // never trim passwords
        name: nameTrim || null,
        tel: telTrim || null,
        address: addressTrim || null,
        city: cityTrim || null,
        country: countryTrim || null,
        role_id: roleId, // fixed
        organization_id: organizationId ? Number(organizationId) : null,
      };

      // CSRF: If your backend uses cookie-based auth, ensure you also use CSRF protection.
      // If you have a CSRF token (meta tag/cookie), attach it here.
      const csrfToken = document
        .querySelector('meta[name="csrf-token"]')
        ?.getAttribute("content");

      const res = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
        },
        credentials: "include", // supports HttpOnly cookies (recommended)
        referrerPolicy: "no-referrer",
        cache: "no-store",
        body: JSON.stringify(payload),
        signal: abortRef.current.signal,
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        // Don’t leak server internals; show safe message if detail is not present
        throw new Error(data?.detail || "Registration failed. Please try again.");
      }

      // Best practice: backend sets HttpOnly session cookie. No token storage needed.
      // If your backend still returns a token and you must keep legacy compatibility:
      if (ALLOW_TOKEN_STORAGE && data?.token) {
        sessionStorage.setItem("token", data.token);
        if (data?.expires_at) sessionStorage.setItem("token_expires_at", data.expires_at);
      }

      // Clear sensitive fields
      setPassword("");
      setConfirmPassword("");

      navigate("/");
    } catch (err) {
      if (err?.name === "AbortError") {
        setError("Request timed out or was cancelled. Please try again.");
      } else {
        setError(err?.message || "Something went wrong.");
      }
      queueMicrotask(() => errorRef.current?.focus());
    } finally {
      setLoading(false);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    }
  }

  return (
    <div className="min-h-[calc(100vh-56px)] bg-gradient-to-b from-slate-50 via-white to-slate-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-3xl">
        <div className="bg-white/80 backdrop-blur rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-6 sm:px-8 border-b border-slate-200 bg-white">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
              Create your account
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Sign up to access the AI Test Assistant.
            </p>
          </div>

          <div className="px-6 py-6 sm:px-8">
            {error && (
              <div
                ref={errorRef}
                tabIndex={-1}
                role="alert"
                aria-live="polite"
                className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 focus:outline-none focus:ring-2 focus:ring-red-300"
              >
                {error}
              </div>
            )}

            <form
              onSubmit={handleSubmit}
              className="space-y-7"
              autoComplete="on"
              noValidate
            >
              {/* ACCOUNT */}
              <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">Account</h2>
                    <p className="text-xs text-slate-500 mt-1">
                      Use a strong password. We recommend 12+ characters.
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-slate-700">
                      Email <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="email"
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      inputMode="email"
                      required
                    />
                    <div className="mt-1 text-xs">
                      {email.length > 0 && !emailValid ? (
                        <span className="text-amber-700">Please enter a valid email.</span>
                      ) : (
                        <span className="text-slate-500">We’ll never share your email.</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700">
                      Password <span className="text-red-600">*</span>
                    </label>
                    <div className="mt-1 relative">
                      <input
                        type={showPw ? "text" : "password"}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 pr-12 text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="new-password"
                        minLength={12}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw((v) => !v)}
                        className="absolute inset-y-0 right-0 px-3 text-sm font-medium text-slate-600 hover:text-slate-900"
                        aria-label={showPw ? "Hide password" : "Show password"}
                      >
                        {showPw ? "Hide" : "Show"}
                      </button>
                    </div>

                    <div className="mt-2">
                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className={`h-2 transition-all ${
                            password.length === 0
                              ? "w-0"
                              : passwordValid
                              ? "w-5/6 bg-green-500"
                              : "w-1/3 bg-amber-500"
                          }`}
                          aria-hidden
                        />
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        Must be 12+ characters and include letters and numbers.
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700">
                      Confirm password <span className="text-red-600">*</span>
                    </label>
                    <input
                      type={showPw ? "text" : "password"}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                      minLength={12}
                      required
                    />
                    <div className="mt-1 text-xs">
                      {confirmPassword.length > 0 && password !== confirmPassword ? (
                        <span className="text-amber-700">Passwords don’t match.</span>
                      ) : (
                        <span className="text-slate-500">&nbsp;</span>
                      )}
                    </div>
                  </div>
                </div>
              </section>

              {/* PROFILE */}
              <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
                <h2 className="text-sm font-semibold text-slate-900">Profile</h2>

                <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-slate-700">
                      Name
                    </label>
                    <input
                      type="text"
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      autoComplete="name"
                      maxLength={120}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700">
                      Phone
                    </label>
                    <input
                      type="tel"
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={tel}
                      onChange={(e) => setTel(e.target.value)}
                      placeholder="+46..."
                      autoComplete="tel"
                      inputMode="tel"
                      maxLength={40}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700">
                      City
                    </label>
                    <input
                      type="text"
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      autoComplete="address-level2"
                      maxLength={120}
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-slate-700">
                      Address
                    </label>
                    <input
                      type="text"
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      autoComplete="street-address"
                      maxLength={200}
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-slate-700">
                      Country
                    </label>
                    <input
                      type="text"
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      placeholder="Sweden"
                      autoComplete="country-name"
                      maxLength={80}
                    />
                  </div>
                </div>
              </section>

              {/* ORGANIZATION */}
              <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">Organization</h2>
                    <p className="text-xs text-slate-600 mt-1">
                      Role is assigned by the system (default: Tester).
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-full px-3 py-1">
                    Role: Tester
                  </span>
                </div>

                <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700">
                      Organization ID (optional)
                    </label>
                    <input
                      type="text"
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={organizationId}
                      onChange={(e) => setOrganizationId(e.target.value)}
                      placeholder="e.g. 1"
                      inputMode="numeric"
                      pattern="^[1-9]\d*$"
                      aria-invalid={!orgIdValid}
                    />
                    <div className="mt-1 text-xs">
                      {!orgIdValid ? (
                        <span className="text-amber-700">
                          Must be a positive integer (or blank).
                        </span>
                      ) : (
                        <span className="text-slate-500">Leave blank if not applicable.</span>
                      )}
                    </div>
                  </div>

                  <div className="hidden sm:block" />
                </div>
              </section>

              <button
                type="submit"
                disabled={!canSubmit}
                className="w-full rounded-xl bg-blue-700 px-4 py-3 text-white font-semibold shadow-sm hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? "Creating account..." : "Create account"}
              </button>

              <p className="text-sm text-slate-600 text-center">
                Already have an account?{" "}
                <Link to="/login" className="text-blue-700 font-semibold hover:underline">
                  Log in
                </Link>
              </p>

              <p className="text-xs text-slate-500 text-center">
                By creating an account you agree to your organization’s policies.
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
// ...existing code...
