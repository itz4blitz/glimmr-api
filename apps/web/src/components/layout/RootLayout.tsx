import { Outlet } from "react-router-dom";
// import { ActivityTracker } from '@/components/ActivityTracker'

export function RootLayout() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* <ActivityTracker /> - Disabled to prevent session spam */}
      <Outlet />
    </div>
  );
}
