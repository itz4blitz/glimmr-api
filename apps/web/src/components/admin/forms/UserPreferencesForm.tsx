import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  Settings,
  Bell,
  Palette,
  Globe,
  Clock,
  Shield,
  Save,
  X,
} from "lucide-react";
import { useFormState } from "@/hooks/useFormState";
import { useUserManagementStore } from "@/stores/userManagement";
import type {
  UserWithProfile,
  PreferencesUpdateData,
} from "@/types/userManagement";

interface UserPreferencesFormProps {
  user: UserWithProfile;
  onSave?: () => void;
  onCancel?: () => void;
  isLoading?: boolean;
}

const themes = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

const languages = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "it", label: "Italian" },
  { value: "pt", label: "Portuguese" },
  { value: "ja", label: "Japanese" },
  { value: "ko", label: "Korean" },
  { value: "zh", label: "Chinese" },
];

const timezones = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Australia/Sydney",
];

const dateFormats = [
  { value: "MM/DD/YYYY", label: "MM/DD/YYYY (US)" },
  { value: "DD/MM/YYYY", label: "DD/MM/YYYY (EU)" },
  { value: "YYYY-MM-DD", label: "YYYY-MM-DD (ISO)" },
  { value: "DD MMM YYYY", label: "DD MMM YYYY" },
];

const timeFormats = [
  { value: "12h", label: "12 Hour (AM/PM)" },
  { value: "24h", label: "24 Hour" },
];

export function UserPreferencesForm({
  user,
  onSave,
  onCancel,
}: UserPreferencesFormProps) {
  const { updateUserPreferences } = useUserManagementStore();

  // Prepare initial form data with defaults - use useMemo to prevent re-creation
  const initialData: PreferencesUpdateData = React.useMemo(
    () => ({
      notificationEmail: user.preferences?.notificationEmail ?? true,
      notificationPush: user.preferences?.notificationPush ?? true,
      notificationSms: user.preferences?.notificationSms ?? false,
      themePreference: user.preferences?.themePreference ?? "system",
      languagePreference: user.preferences?.languagePreference ?? "en",
      timezonePreference: user.preferences?.timezonePreference ?? "UTC",
      dateFormat: user.preferences?.dateFormat ?? "MM/DD/YYYY",
      timeFormat: user.preferences?.timeFormat ?? "12h",
      privacySettings: user.preferences?.privacySettings ?? {
        profileVisibility: "public" as const,
        showEmail: true,
        showPhone: true,
        showLocation: true,
      },
      dashboardLayout: user.preferences?.dashboardLayout ?? {
        widgets: [],
        theme: "default",
      },
    }),
    [user.preferences],
  );

  const { formData, isSubmitting, setFieldValue, canSave, save, cancel } =
    useFormState<PreferencesUpdateData>({
      initialData,
      onSave: async (data) => {
        await updateUserPreferences(user.id, data);
        onSave?.();
      },
      onCancel: () => {
        onCancel?.();
      },
    });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">User Preferences</h3>
          <p className="text-sm text-muted-foreground">
            Manage notification settings, appearance, and other preferences
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={cancel} disabled={isSubmitting}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button
            onClick={save}
            disabled={!canSave || isSubmitting}
            className="min-w-[100px]"
          >
            {isSubmitting ? (
              <>
                <Clock className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications
          </CardTitle>
          <CardDescription>
            Configure how the user receives notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Email Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Receive notifications via email
              </p>
            </div>
            <Switch
              checked={formData.notificationEmail}
              onCheckedChange={(checked) =>
                setFieldValue("notificationEmail", checked)
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Push Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Receive push notifications in the browser
              </p>
            </div>
            <Switch
              checked={formData.notificationPush}
              onCheckedChange={(checked) =>
                setFieldValue("notificationPush", checked)
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>SMS Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Receive notifications via SMS (requires phone number)
              </p>
            </div>
            <Switch
              checked={formData.notificationSms}
              onCheckedChange={(checked) =>
                setFieldValue("notificationSms", checked)
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Appearance
          </CardTitle>
          <CardDescription>
            Customize the user interface appearance
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="theme">Theme</Label>
            <Select
              value={formData.themePreference}
              onValueChange={(value) => setFieldValue("themePreference", value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {themes.map((theme) => (
                  <SelectItem key={theme.value} value={theme.value}>
                    {theme.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Localization */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Localization
          </CardTitle>
          <CardDescription>
            Language, timezone, and format preferences
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="language">Language</Label>
              <Select
                value={formData.languagePreference}
                onValueChange={(value) =>
                  setFieldValue("languagePreference", value)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {languages.map((lang) => (
                    <SelectItem key={lang.value} value={lang.value}>
                      {lang.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Select
                value={formData.timezonePreference}
                onValueChange={(value) =>
                  setFieldValue("timezonePreference", value)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {timezones.map((tz) => (
                    <SelectItem key={tz} value={tz}>
                      {tz}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dateFormat">Date Format</Label>
              <Select
                value={formData.dateFormat}
                onValueChange={(value) => setFieldValue("dateFormat", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {dateFormats.map((format) => (
                    <SelectItem key={format.value} value={format.value}>
                      {format.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="timeFormat">Time Format</Label>
              <Select
                value={formData.timeFormat}
                onValueChange={(value) => setFieldValue("timeFormat", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {timeFormats.map((format) => (
                    <SelectItem key={format.value} value={format.value}>
                      {format.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Privacy Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Privacy Settings
          </CardTitle>
          <CardDescription>
            Control privacy and data sharing preferences
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Profile Visibility</Label>
              <p className="text-sm text-muted-foreground">
                Control who can view the profile
              </p>
            </div>
            <Select
              value={formData.privacySettings?.profileVisibility ?? "public"}
              onValueChange={(value) => {
                const newSettings = {
                  ...(formData.privacySettings || {}),
                  profileVisibility: value as "public" | "private" | "friends",
                };
                setFieldValue("privacySettings", newSettings);
              }}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">Public</SelectItem>
                <SelectItem value="private">Private</SelectItem>
                <SelectItem value="friends">Friends</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Show Email</Label>
              <p className="text-sm text-muted-foreground">
                Display email address on profile
              </p>
            </div>
            <Switch
              checked={formData.privacySettings?.showEmail ?? true}
              onCheckedChange={(checked) => {
                const newSettings = {
                  ...(formData.privacySettings || {}),
                  showEmail: checked,
                };
                setFieldValue("privacySettings", newSettings);
              }}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Show Phone</Label>
              <p className="text-sm text-muted-foreground">
                Display phone number on profile
              </p>
            </div>
            <Switch
              checked={formData.privacySettings?.showPhone ?? true}
              onCheckedChange={(checked) => {
                const newSettings = {
                  ...(formData.privacySettings || {}),
                  showPhone: checked,
                };
                setFieldValue("privacySettings", newSettings);
              }}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Show Location</Label>
              <p className="text-sm text-muted-foreground">
                Display location information on profile
              </p>
            </div>
            <Switch
              checked={formData.privacySettings?.showLocation ?? true}
              onCheckedChange={(checked) => {
                const newSettings = {
                  ...(formData.privacySettings || {}),
                  showLocation: checked,
                };
                setFieldValue("privacySettings", newSettings);
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Dashboard Layout */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Dashboard Layout
          </CardTitle>
          <CardDescription>
            Customize dashboard appearance and theme
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Dashboard Theme</Label>
            <Select
              value={formData.dashboardLayout?.theme ?? "default"}
              onValueChange={(value) => {
                const newLayout = {
                  ...(formData.dashboardLayout || {}),
                  theme: value,
                };
                setFieldValue("dashboardLayout", newLayout);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Default</SelectItem>
                <SelectItem value="compact">Compact</SelectItem>
                <SelectItem value="modern">Modern</SelectItem>
                <SelectItem value="classic">Classic</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Dashboard Widgets</Label>
            <p className="text-sm text-muted-foreground">
              Dashboard widgets can be configured from the dashboard settings
            </p>
            <p className="text-sm text-muted-foreground">
              Currently {formData.dashboardLayout?.widgets?.length || 0} widgets configured
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
