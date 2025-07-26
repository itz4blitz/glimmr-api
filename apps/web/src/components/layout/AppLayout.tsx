import { useEffect, useState, type ReactNode } from "react";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { useSidebarStore } from "@/stores/sidebar";
import { useNavigation } from "@/hooks/useNavigation";
import { cn } from "@/lib/utils";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { isCollapsed, toggleSidebar } = useSidebarStore();
  const { isPending } = useNavigation();
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Only show initial animation once
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitialLoad(false);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Keyboard shortcut to toggle sidebar (Ctrl/Cmd + B)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "b") {
        event.preventDefault();
        toggleSidebar();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleSidebar]);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Desktop Sidebar - Fixed Position */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Main Content - Adjusted for Fixed Sidebar */}
      <main
        className={cn(
          "min-h-[calc(100vh-3.5rem)] transition-all duration-300 relative",
          isCollapsed ? "md:ml-16" : "md:ml-64",
        )}
      >
        {/* Smooth loading indicator */}
        {isPending && <div className="nav-loading-bar" />}

        <div
          className={cn(
            "page-enter transition-opacity duration-200",
            isPending && "opacity-90",
          )}
        >
          {children}
        </div>
      </main>
    </div>
  );
}
