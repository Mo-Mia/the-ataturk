import { Link, Outlet } from "react-router-dom";

import { ActiveVersionBanner } from "./ActiveVersionBanner";
import "../admin.css";

export function AdminLayout() {
  return (
    <main className="admin-shell">
      <header className="admin-top">
        <div>
          <p className="admin-muted">The Atatürk</p>
          <h1>Admin</h1>
        </div>
        <nav className="admin-nav" aria-label="Admin navigation">
          <Link to="/admin">Home</Link>
          <Link to="/admin/clubs">Clubs</Link>
          <Link to="/admin/dataset-versions">Dataset versions</Link>
          <Link to="/admin/profile-versions">Profile versions</Link>
          <Link to="/admin/extract-profiles">Extract profiles</Link>
        </nav>
      </header>
      <ActiveVersionBanner />
      <Outlet />
    </main>
  );
}
