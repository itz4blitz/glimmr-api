import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuthStore } from "@/stores/auth";
import { useUnsavedChangesContext } from "@/contexts/UnsavedChangesContext.hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { toast } from "sonner";
import { Loader2, Save, X } from "lucide-react";

const profileSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(50),
  lastName: z.string().min(1, "Last name is required").max(50),
  bio: z.string().max(500, "Bio must be less than 500 characters").optional(),
  phoneNumber: z
    .string()
    .regex(/^\+?[\d\s\-()]+$/, "Invalid phone number")
    .optional()
    .or(z.literal("")),
  company: z.string().max(100).optional(),
  jobTitle: z.string().max(100).optional(),
  city: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  website: z.string().url("Invalid URL").optional().or(z.literal("")),
  linkedinUrl: z
    .string()
    .url("Invalid LinkedIn URL")
    .optional()
    .or(z.literal("")),
  twitterUrl: z
    .string()
    .url("Invalid Twitter URL")
    .optional()
    .or(z.literal("")),
  githubUrl: z.string().url("Invalid GitHub URL").optional().or(z.literal("")),
  timezone: z.string().optional(),
  languagePreference: z.string().optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

export function ProfileForm() {
  const { user, updateUser } = useAuthStore();
  const { setHasUnsavedChanges, registerSaveFunction } =
    useUnsavedChangesContext();
  const [isLoading, setIsLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      bio: user?.profile?.bio || "",
      phoneNumber: user?.profile?.phoneNumber || "",
      company: user?.profile?.company || "",
      jobTitle: user?.profile?.jobTitle || "",
      city: user?.profile?.city || "",
      country: user?.profile?.country || "",
      website: user?.profile?.website || "",
      linkedinUrl: user?.profile?.linkedinUrl || "",
      twitterUrl: user?.profile?.twitterUrl || "",
      githubUrl: user?.profile?.githubUrl || "",
      timezone: user?.profile?.timezone || "UTC",
      languagePreference: user?.profile?.languagePreference || "en",
    },
  });

  // Reset form when user data changes
  useEffect(() => {
    if (user) {
      form.reset({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        bio: user.profile?.bio || "",
        phoneNumber: user.profile?.phoneNumber || "",
        company: user.profile?.company || "",
        jobTitle: user.profile?.jobTitle || "",
        city: user.profile?.city || "",
        country: user.profile?.country || "",
        website: user.profile?.website || "",
        linkedinUrl: user.profile?.linkedinUrl || "",
        twitterUrl: user.profile?.twitterUrl || "",
        githubUrl: user.profile?.githubUrl || "",
        timezone: user.profile?.timezone || "UTC",
        languagePreference: user.profile?.languagePreference || "en",
      });
      setHasChanges(false); // Reset changes when form resets
    }
  }, [user, form]);

  // Watch for changes to show/hide action buttons
  const watchedValues = form.watch();

  useEffect(() => {
    if (!user) return;

    const currentValues = {
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      bio: user.profile?.bio || "",
      phoneNumber: user.profile?.phoneNumber || "",
      company: user.profile?.company || "",
      jobTitle: user.profile?.jobTitle || "",
      city: user.profile?.city || "",
      country: user.profile?.country || "",
      website: user.profile?.website || "",
      linkedinUrl: user.profile?.linkedinUrl || "",
      twitterUrl: user.profile?.twitterUrl || "",
      githubUrl: user.profile?.githubUrl || "",
      timezone: user.profile?.timezone || "UTC",
      languagePreference: user.profile?.languagePreference || "en",
    };

    const hasFormChanges = Object.keys(currentValues).some((key) => {
      return (
        watchedValues[key as keyof ProfileFormData] !==
        currentValues[key as keyof typeof currentValues]
      );
    });
    setHasChanges(hasFormChanges);
    setHasUnsavedChanges(hasFormChanges);
  }, [watchedValues, user, setHasUnsavedChanges]);

  const saveProfile = useCallback(async () => {
    const data = form.getValues();
    if (!user) return;

    setIsLoading(true);
    try {
      // Here you would call your API to update the profile
      // For now, we'll just update the local state
      await updateUser({
        ...user,
        firstName: data.firstName,
        lastName: data.lastName,
        profile: {
          ...user.profile,
          bio: data.bio,
          phoneNumber: data.phoneNumber,
          company: data.company,
          jobTitle: data.jobTitle,
          city: data.city,
          country: data.country,
          website: data.website,
          linkedinUrl: data.linkedinUrl,
          twitterUrl: data.twitterUrl,
          githubUrl: data.githubUrl,
          timezone: data.timezone,
          languagePreference: data.languagePreference,
        },
      });

      setHasChanges(false);
      setHasUnsavedChanges(false);
    } finally {
      setIsLoading(false);
    }
  }, [form, user, updateUser, setHasUnsavedChanges]);

  const onSubmit = async () => {
    await saveProfile();
    toast.success("Profile updated successfully!", {
      description: "Your changes have been saved and are now visible.",
      duration: 3000,
    });
  };

  // Register save function with context
  useEffect(() => {
    registerSaveFunction(saveProfile);
  }, [registerSaveFunction, saveProfile]);

  const handleCancel = () => {
    form.reset();
    setHasChanges(false);
    setHasUnsavedChanges(false);
    toast.info("Changes discarded", {
      description: "Your profile changes have been cancelled.",
      duration: 2000,
    });
  };

  // Always show the editable form

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Information */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm">First Name</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Enter your first name"
                    className="input-enhanced"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="lastName"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm">Last Name</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Enter your last name"
                    className="input-enhanced"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Bio */}
        <FormField
          control={form.control}
          name="bio"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm">Bio</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Tell us about yourself..."
                  className="textarea-enhanced min-h-[80px] sm:min-h-[100px]"
                  {...field}
                />
              </FormControl>
              <FormDescription className="text-xs">
                Brief description about yourself (max 500 characters)
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Contact Information */}
        <FormField
          control={form.control}
          name="phoneNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm">Phone Number</FormLabel>
              <FormControl>
                <Input
                  placeholder="+1 (555) 123-4567"
                  className="input-enhanced"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Professional Information */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          <FormField
            control={form.control}
            name="company"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm">Company</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Your company"
                    className="input-enhanced"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="jobTitle"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm">Job Title</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Your job title"
                    className="input-enhanced"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Action Buttons - Always visible, disabled when no changes */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 pt-4 border-t border-border/50 mt-6">
          <Button
            type="submit"
            disabled={isLoading || !hasChanges}
            className="button-primary-enhanced w-full sm:w-auto"
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Save className="mr-2 h-4 w-4" />
            Save Changes
          </Button>
          {hasChanges && (
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              className="button-enhanced w-full sm:w-auto"
            >
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
          )}
        </div>
      </form>
    </Form>
  );
}
