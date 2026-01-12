import { useState } from "react";
import logo from "../images/AI_Test_Assistant_logo.png";

function NavItem({ label }) {
  return (
    <button
      type="button"
      className="rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
    >
      {label}
    </button>
  );
}

export default function SideHeaderLayout({ children }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Mobile header */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80 md:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900"
        >
          ☰ Menu
        </button>

        

        <div className="w-[72px]" />
      </header>

      <div className="mx-auto flex max-w-6xl">
        {/* Sidebar */}
        <aside
          className={[
            "fixed inset-y-0 left-0 z-40 w-72 border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900",
            "transform transition-transform md:static md:translate-x-0",
            open ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          ].join(" ")}
        >
          <div className="flex items-center justify-between px-6 py-5 md:justify-start md:gap-3">
            <div className="flex items-center gap-3">
              <img
  src={logo}
  alt="AI Test Assistant Logo"
  className="h-2 w-auto object-contain"
/>

              <span className="text-lg font-bold tracking-tight">AI Test Assistant</span>
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950 md:hidden"
            >
              ✕
            </button>
          </div>

          <nav className="flex flex-col gap-1 px-3">
            <NavItem label="Generate Tests" />
            <NavItem label="History" />
            <NavItem label="Docs" />
          </nav>

          <div className="mt-auto border-t border-slate-200 px-6 py-4 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
            © 2026 AI Test Assistant
          </div>
        </aside>

        {/* Overlay */}
        {open && (
          <div
            className="fixed inset-0 z-30 bg-black/40 md:hidden"
            onClick={() => setOpen(false)}
          />
        )}

        {/* Content */}
        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
