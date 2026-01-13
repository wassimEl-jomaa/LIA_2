import { Routes, Route } from "react-router-dom";
import Header from "./pages/Header.jsx";
import Home from "./pages/Home.jsx";
import TestCases from "./pages/TestCases.jsx";
import AboutUs from "./pages/AboutUs.jsx";

export default function App() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Routes>
          {/* START PAGE */}
          <Route path="/" element={<Home />} />

          {/* OTHER PAGES */}
          <Route path="/testcases" element={<TestCases />} />
          <Route path="/about" element={<AboutUs />} />
        </Routes>
      </main>
    </>
  );
}