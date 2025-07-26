import { useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import apiClient from "@/lib/api";
import { toast } from "sonner";
import {
  Bell,
  Mail,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Info,
} from "lucide-react";

interface NotificationPreferences {
  emailEnabled: boolean;
  inAppEnabled: boolean;
  jobSuccessEnabled: boolean;
  jobFailureEnabled: boolean;
  jobWarningEnabled: boolean;
  systemAlertEnabled: boolean;
}

export function NotificationPreferences() {
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    emailEnabled: true,
    inAppEnabled: true,
    jobSuccessEnabled: true,
    jobFailureEnabled: true,
    jobWarningEnabled: true,
    systemAlertEnabled: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get("/notifications/preferences");
      setPreferences(response.data);
    } catch (error) {
      console.error("Failed to fetch preferences:", error);
      toast.error("Failed to load notification preferences");
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async () => {
    try {
      setSaving(true);
      await apiClient.put("/notifications/preferences", preferences);
      toast.success("Notification preferences saved");
    } catch (error) {
      console.error("Failed to save preferences:", error);
      toast.error("Failed to save notification preferences");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = (key: keyof NotificationPreferences) => {
    setPreferences((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-48">
          <p className="text-muted-foreground">Loading preferences...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notification Preferences</CardTitle>
        <CardDescription>
          Choose how you want to be notified about job activities and system
          alerts
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Notification Channels */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium">Notification Channels</h3>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="in-app" className="flex flex-col gap-1">
                <span>In-App Notifications</span>
                <span className="text-xs text-muted-foreground font-normal">
                  Show notifications in the application
                </span>
              </Label>
            </div>
            <Switch
              id="in-app"
              checked={preferences.inAppEnabled}
              onCheckedChange={() => handleToggle("inAppEnabled")}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="email" className="flex flex-col gap-1">
                <span>Email Notifications</span>
                <span className="text-xs text-muted-foreground font-normal">
                  Send notifications to your email
                </span>
              </Label>
            </div>
            <Switch
              id="email"
              checked={preferences.emailEnabled}
              onCheckedChange={() => handleToggle("emailEnabled")}
            />
          </div>
        </div>

        <Separator />

        {/* Notification Types */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium">Notification Types</h3>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <Label htmlFor="job-success" className="flex flex-col gap-1">
                <span>Job Success</span>
                <span className="text-xs text-muted-foreground font-normal">
                  Notify when jobs complete successfully
                </span>
              </Label>
            </div>
            <Switch
              id="job-success"
              checked={preferences.jobSuccessEnabled}
              onCheckedChange={() => handleToggle("jobSuccessEnabled")}
              disabled={!preferences.inAppEnabled && !preferences.emailEnabled}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <Label htmlFor="job-failure" className="flex flex-col gap-1">
                <span>Job Failures</span>
                <span className="text-xs text-muted-foreground font-normal">
                  Notify when jobs fail or encounter errors
                </span>
              </Label>
            </div>
            <Switch
              id="job-failure"
              checked={preferences.jobFailureEnabled}
              onCheckedChange={() => handleToggle("jobFailureEnabled")}
              disabled={!preferences.inAppEnabled && !preferences.emailEnabled}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              <Label htmlFor="job-warning" className="flex flex-col gap-1">
                <span>Job Warnings</span>
                <span className="text-xs text-muted-foreground font-normal">
                  Notify about job warnings and stalled jobs
                </span>
              </Label>
            </div>
            <Switch
              id="job-warning"
              checked={preferences.jobWarningEnabled}
              onCheckedChange={() => handleToggle("jobWarningEnabled")}
              disabled={!preferences.inAppEnabled && !preferences.emailEnabled}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-blue-500" />
              <Label htmlFor="system-alert" className="flex flex-col gap-1">
                <span>System Alerts</span>
                <span className="text-xs text-muted-foreground font-normal">
                  Important system notifications and updates
                </span>
              </Label>
            </div>
            <Switch
              id="system-alert"
              checked={preferences.systemAlertEnabled}
              onCheckedChange={() => handleToggle("systemAlertEnabled")}
              disabled={!preferences.inAppEnabled && !preferences.emailEnabled}
            />
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <Button onClick={savePreferences} disabled={saving}>
            {saving ? "Saving..." : "Save Preferences"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
