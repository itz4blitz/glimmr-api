import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuthStore } from "@/stores/auth";
import { useTheme } from "@/hooks/useTheme";
import { useUnsavedChangesContext } from "@/contexts/UnsavedChangesContext";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  
  
  Palette,
  Globe,
  
  
  Loader2,
  Save,
} from "lucide-react";
import { NotificationPreferences } from "@/components/notifications/NotificationPreferences";

const preferencesSchema = z.object({
  notificationEmail: z.boolean(),
  notificationPush: z.boolean(),
  notificationSms: z.boolean(),
  themePreference: z.enum(["light", "dark"]),
  languagePreference: z.string(),
  timezonePreference: z.string(),
  dateFormat: z.string(),
  timeFormat: z.enum(["12h", "24h"]),
});

type PreferencesFormData = z.infer<typeof preferencesSchema>;

const timezones = [
  { value: "UTC", label: "UTC" },
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "Europe/London", label: "London (GMT)" },
  { value: "Europe/Paris", label: "Paris (CET)" },
  { value: "Europe/Berlin", label: "Berlin (CET)" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)" },
  { value: "Asia/Shanghai", label: "Shanghai (CST)" },
  { value: "Australia/Sydney", label: "Sydney (AEDT)" },
];

const languages = [
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
  { value: "fr", label: "Français" },
  { value: "de", label: "Deutsch" },
  { value: "it", label: "Italiano" },
  { value: "pt", label: "Português" },
  { value: "ja", label: "日本語" },
  { value: "ko", label: "한국어" },
  { value: "zh", label: "中文" },
];

const dateFormats = [
  { value: "MM/DD/YYYY", label: "MM/DD/YYYY (US)" },
  { value: "DD/MM/YYYY", label: "DD/MM/YYYY (UK)" },
  { value: "YYYY-MM-DD", label: "YYYY-MM-DD (ISO)" },
  { value: "DD.MM.YYYY", label: "DD.MM.YYYY (DE)" },
];

export function PreferencesSettings() {
  const { user, updateUser } = useAuthStore();
  const { theme, setTheme } = useTheme();
  const { setHasUnsavedChanges, registerSaveFunction } =
    useUnsavedChangesContext();
  const [isLoading, setIsLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const defaultValues = {
    notificationEmail: user?.preferences?.notificationEmail ?? true,
    notificationPush: user?.preferences?.notificationPush ?? true,
    notificationSms: user?.preferences?.notificationSms ?? false,
    themePreference:
      (user?.preferences?.themePreference as "light" | "dark") ?? theme,
    languagePreference: user?.preferences?.languagePreference ?? "en",
    timezonePreference: user?.preferences?.timezonePreference ?? "UTC",
    dateFormat: user?.preferences?.dateFormat ?? "MM/DD/YYYY",
    timeFormat: (user?.preferences?.timeFormat as "12h" | "24h") ?? "12h",
  };

  const form = useForm<PreferencesFormData>({
    resolver: zodResolver(preferencesSchema),
    defaultValues,
  });

  // Watch for changes to enable/disable save button
  const watchedValues = form.watch();

  useEffect(() => {
    if (!user) return;

    const hasFormChanges = Object.keys(defaultValues).some((key) => {
      return (
        watchedValues[key as keyof PreferencesFormData] !==
        defaultValues[key as keyof typeof defaultValues]
      );
    });
    setHasChanges(hasFormChanges);
    setHasUnsavedChanges(hasFormChanges);
  }, [watchedValues, user, setHasUnsavedChanges]);

  const savePreferences = async () => {
    const data = form.getValues();
    if (!user) return;

    setIsLoading(true);
    try {
      // Update theme immediately
      setTheme(data.themePreference);

      // Here you would call your API to update preferences
      await new Promise((resolve) => setTimeout(resolve, 1500)); // Simulate API call

      // Update user preferences in store
      await updateUser({
        ...user,
        preferences: {
          ...user.preferences,
          ...data,
        },
      });

      setHasChanges(false);
      setHasUnsavedChanges(false);
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = async () => {
    await savePreferences();
    toast.success("Preferences updated successfully!", {
      description: "Your settings have been saved and applied.",
      duration: 3000,
    });
  };

  // Register save function with context
  useEffect(() => {
    registerSaveFunction(savePreferences);
  }, [registerSaveFunction]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Notifications */}
        <NotificationPreferences />

        {/* Appearance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Appearance
            </CardTitle>
            <CardDescription>
              Customize how the application looks and feels
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="themePreference"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Theme</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="select-enhanced">
                        <SelectValue placeholder="Select a theme" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="select-content-enhanced">
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="dark">Dark</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Choose your preferred color theme
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
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
              Set your language, timezone, and date format preferences
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="languagePreference"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Language</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger className="select-enhanced">
                          <SelectValue placeholder="Select a language" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="select-content-enhanced">
                        {languages.map((language) => (
                          <SelectItem
                            key={language.value}
                            value={language.value}
                          >
                            {language.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="timezonePreference"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Timezone</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger className="select-enhanced">
                          <SelectValue placeholder="Select a timezone" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="select-content-enhanced">
                        {timezones.map((timezone) => (
                          <SelectItem
                            key={timezone.value}
                            value={timezone.value}
                          >
                            {timezone.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="dateFormat"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date Format</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger className="select-enhanced">
                          <SelectValue placeholder="Select date format" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="select-content-enhanced">
                        {dateFormats.map((format) => (
                          <SelectItem key={format.value} value={format.value}>
                            {format.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="timeFormat"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Time Format</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger className="select-enhanced">
                          <SelectValue placeholder="Select time format" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="select-content-enhanced">
                        <SelectItem value="12h">12-hour (AM/PM)</SelectItem>
                        <SelectItem value="24h">24-hour</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-start pt-4 border-t border-border/50 mt-6">
          <Button
            type="submit"
            disabled={isLoading || !hasChanges}
            className="button-primary-enhanced w-full sm:w-auto"
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Save className="mr-2 h-4 w-4" />
            Save Preferences
          </Button>
        </div>
      </form>
    </Form>
  );
}
