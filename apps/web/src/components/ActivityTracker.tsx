import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useAuthStore } from "@/stores/auth";
import { apiClient } from "@/lib/api";

export function ActivityTracker() {
  const location = useLocation();
  const { isAuthenticated, user } = useAuthStore();
  const lastPathRef = useRef<string>("");
  const sessionPingIntervalRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const lastActivityRef = useRef<number>(Date.now());

  // Track page views
  useEffect(() => {
    if (isAuthenticated && user && location.pathname !== lastPathRef.current) {
      lastPathRef.current = location.pathname;

      // Don't track API calls that result from page tracking
      apiClient
        .post("/activity/page-view", {
          page: location.pathname,
          referrer: document.referrer,
          metadata: {
            search: location.search,
            hash: location.hash,
            title: document.title,
            screenWidth: window.screen.width,
            screenHeight: window.screen.height,
            viewport: {
              width: window.innerWidth,
              height: window.innerHeight,
            },
          },
        })
        .catch((err) => {
          console.error("Failed to track page view:", err);
        });
    }
  }, [location, isAuthenticated, user]);

  // Track session activity
  useEffect(() => {
    if (isAuthenticated && user) {
      // Send session start
      apiClient
        .post("/activity/session", {
          action: "start",
          metadata: {
            userAgent: navigator.userAgent,
            language: navigator.language,
            platform: navigator.platform,
            cookieEnabled: navigator.cookieEnabled,
          },
        })
        .catch((err) => {
          console.error("Failed to track session start:", err);
        });

      // Set up session ping every 5 minutes
      sessionPingIntervalRef.current = setInterval(() => {
        const inactiveTime = Date.now() - lastActivityRef.current;

        // Only send ping if user has been active in the last 10 minutes
        if (inactiveTime < 600000) {
          apiClient
            .post("/activity/session", {
              action: "ping",
              metadata: {
                inactiveTime,
                currentPage: location.pathname,
              },
            })
            .catch((err) => {
              console.error("Failed to send session ping:", err);
            });
        }
      }, 300000); // 5 minutes

      // Track user activity
      const handleActivity = () => {
        lastActivityRef.current = Date.now();
      };

      window.addEventListener("mousemove", handleActivity);
      window.addEventListener("keypress", handleActivity);
      window.addEventListener("click", handleActivity);
      window.addEventListener("scroll", handleActivity);

      return () => {
        // Send session end
        apiClient
          .post("/activity/session", {
            action: "end",
            metadata: {
              duration: Date.now() - lastActivityRef.current,
              lastPage: location.pathname,
            },
          })
          .catch((err) => {
            console.error("Failed to track session end:", err);
          });

        // Clean up interval
        if (sessionPingIntervalRef.current) {
          clearInterval(sessionPingIntervalRef.current);
        }

        // Remove event listeners
        window.removeEventListener("mousemove", handleActivity);
        window.removeEventListener("keypress", handleActivity);
        window.removeEventListener("click", handleActivity);
        window.removeEventListener("scroll", handleActivity);
      };
    }
  }, [isAuthenticated, user]);

  // Track page visibility
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (isAuthenticated && user) {
        apiClient
          .post("/activity/page-view", {
            page: location.pathname,
            metadata: {
              event: document.hidden ? "page_hidden" : "page_visible",
              timestamp: new Date().toISOString(),
            },
          })
          .catch((err) => {
            console.error("Failed to track visibility change:", err);
          });
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [location.pathname, isAuthenticated, user]);

  return null;
}
