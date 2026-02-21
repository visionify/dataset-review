import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { api } from "@/api";

export default function Layout({ children }: { children: React.ReactNode }) {
  const loc = useLocation();
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof api.getSummary>> | null>(null);

  const shouldRefetch = loc.pathname === "/" || loc.pathname === "/config" || loc.pathname.startsWith("/images");
  useEffect(() => {
    if (shouldRefetch || !summary) api.getSummary().then(setSummary).catch(() => setSummary(null));
  }, [shouldRefetch]);

  const config = summary?.config;
  const hasTrain = config?.train != null;
  const hasVal = config?.val != null;
  const hasTest = config?.test != null;

  const nav = [
    { to: "/", label: "Classes" },
    { to: "/images/all", label: "All Images" },
    ...(hasTrain ? [{ to: "/images/train", label: "Training" }] : []),
    ...(hasVal ? [{ to: "/images/val", label: "Validation" }] : []),
    ...(hasTest ? [{ to: "/images/test", label: "Test" }] : []),
    { to: "/validation", label: "Validation checks" },
    { to: "/settings", label: "Settings" },
    { to: "/config", label: "Dataset" },
  ];

  return (
    <div className="app-layout">
      <header
        style={{
          padding: "0.75rem 1.5rem",
          borderBottom: "1px solid var(--color-border)",
          background: "var(--color-surface)",
          display: "flex",
          alignItems: "center",
          gap: "1.5rem",
          flexWrap: "wrap",
        }}
      >
        <Link
          to="/"
          style={{
            fontWeight: 700,
            fontSize: "1.125rem",
            color: "var(--color-text)",
            textDecoration: "none",
          }}
        >
          YOLO Dataset Review
        </Link>
        <nav style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          {nav.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className="btn btn-ghost"
              style={{
                textDecoration: "none",
                background: loc.pathname === to ? "oklch(0 0 0 / 0.08)" : undefined,
              }}
            >
              {label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="main-content">{children}</main>
    </div>
  );
}
