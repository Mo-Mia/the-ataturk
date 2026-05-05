import { Outlet } from "react-router-dom";

import { NavigationStrip } from "./NavigationStrip";

export function LayoutShell() {
  return (
    <div className="workbench-shell" data-uat="workbench-shell">
      <NavigationStrip />
      <Outlet />
    </div>
  );
}
