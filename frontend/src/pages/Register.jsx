import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";

const API_BASE = "http://127.0.0.1:8000";

export default function Register() {
  const navigate = useNavigate();

  // Basic auth
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // User info
  const [name, setName] = useState("");
  const [tel, setTel] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");

  // Optional admin fields (can hide in UI if you want)
  const [roleId, setRoleId] = useState(2); // default: Tester (example)
  const [organizationId, setOrganizationId] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // If already logged in → go to projects
  useEffect(() => {
    if (localStorage.getItem("token")) {
      navigate("/projects");
    }
  }, [navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const payload = {
        email,
        password,
        name,
        tel: tel || null,
        address: address || null,
        city: city || null,
        country: country || null,
        role_id: Number(roleId),
        organization_id: organizationId ? Number(organizationId) : null,
      };

      const res = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.detail || "Registration failed");
      }

      // Save token
      localStorage.setItem("token", data.token);
      localStorage.setItem("token_expires_at", data.expires_at);

      // Redirect to projects
      navigate("/projects");
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-56px)] bg-gray-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow border border-gray-100 p-6">
        <h1 className="text-2xl font-bold text-gray-900">Register</h1>
        <p className="text-sm text-gray-600 mt-1">
          Create an account to start generating test cases and managing projects.
        </p>

        {error && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          {/* Account */}
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
            <h2 className="text-sm font-bold text-gray-900">Account</h2>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700">
                  Email
                </label>
                <input
                  type="email"
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700">
                  Password
                </label>
                <input
                  type="password"
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Minimum 8 characters</p>
              </div>
            </div>
          </div>

          {/* Profile */}
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
            <h2 className="text-sm font-bold text-gray-900">Profile</h2>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700">
                  Name
                </label>
                <input
                  type="text"
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700">
                  Phone
                </label>
                <input
                  type="text"
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={tel}
                  onChange={(e) => setTel(e.target.value)}
                  placeholder="+46..."
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700">
                  Address
                </label>
                <input
                  type="text"
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700">
                  City
                </label>
                <input
                  type="text"
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700">
                  Country
                </label>
                <input
                  type="text"
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="Sweden"
                />
              </div>
            </div>
          </div>

          {/* Organization / Role */}
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
            <h2 className="text-sm font-bold text-gray-900">Organization & Role</h2>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700">
                  Role
                </label>
                <select
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={roleId}
                  onChange={(e) => setRoleId(e.target.value)}
                >
                  <option value={1}>Admin</option>
                  <option value={2}>Tester</option>
                  <option value={3}>Test Lead</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  For LIA: you can keep default as Tester.
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700">
                  Organization ID (optional)
                </label>
                <input
                  type="number"
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={organizationId}
                  onChange={(e) => setOrganizationId(e.target.value)}
                  placeholder="e.g. 1"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-blue-700 px-4 py-2 text-white font-semibold hover:bg-blue-800 disabled:opacity-60"
          >
            {loading ? "Creating account..." : "Register"}
          </button>
        </form>

        <div className="mt-5 text-sm text-gray-600">
          Already have an account?{" "}
          <Link to="/login" className="text-blue-700 font-semibold hover:underline">
            Login
          </Link>
        </div>

        <div className="mt-2 text-xs text-gray-500">Backend: {API_BASE}</div>
      </div>
    </div>
  );
}
