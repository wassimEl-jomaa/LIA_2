import { Routes, Route } from "react-router-dom";
import Header from "./pages/Header.jsx";
import Home from "./pages/Home.jsx";
import TestCases from "./pages/TestCases.jsx";
import AboutUs from "./pages/AboutUs.jsx";
import Login from "./pages/Login";
import Register from "./pages/Register";
import MyProjects from "./pages/MyProjects";
import CreateProject from "./pages/CreateProject";
import SelectedProject from "./pages/SelectedProject";
import RequestLogDetails from "./pages/RequestLogDetails";
import ManageProject from "./pages/ManageProject";
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
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/projects" element={<MyProjects />} />
          <Route path="/projects/new" element={<CreateProject />} />
          <Route path="/projects/:projectId" element={<SelectedProject />} />
          <Route path="/projects/:projectId/manage" element={<ManageProject />} />
          <Route path="/projects/:projectId/logs/:logId" element={<RequestLogDetails />} />
        </Routes>
      </main>
    </>
  );
}