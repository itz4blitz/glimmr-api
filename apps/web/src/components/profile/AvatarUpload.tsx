import { useState, useRef } from "react";
import { useAuthStore } from "@/stores/auth";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Upload, Loader2, X, Camera } from "lucide-react";

interface AvatarUploadProps {
  children: React.ReactNode;
}

export function AvatarUpload({ children }: AvatarUploadProps) {
  const { user, updateUser } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB");
      return;
    }

    setSelectedFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!selectedFile || !user) return;

    setIsUploading(true);
    try {
      // Create FormData for file upload
      const formData = new FormData();
      formData.append("avatar", selectedFile);

      // Here you would call your API to upload the avatar
      // For now, we'll simulate the upload and use the preview URL
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Simulate upload delay

      // Update user with new avatar URL (in real app, this would come from the API response)
      const newAvatarUrl = preview; // In real app, this would be the uploaded file URL
      await updateUser({
        ...user,
        profile: {
          ...user.profile,
          avatarUrl: newAvatarUrl || undefined,
        },
      });

      toast.success("Avatar updated successfully!", {
        description: "Your new profile picture has been saved.",
        duration: 3000,
      });
      setIsOpen(false);
      setPreview(null);
      setSelectedFile(null);
    } catch (error) {
      toast.error("Failed to upload avatar", {
        description: "Please check your file and try again.",
        duration: 5000,
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!user) return;

    setIsUploading(true);
    try {
      // Here you would call your API to remove the avatar
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate API call

      // Update user to remove avatar
      await updateUser({
        ...user,
        profile: {
          ...user.profile,
          avatarUrl: undefined,
        },
      });

      toast.success("Avatar removed successfully!", {
        description: "Your profile picture has been removed.",
        duration: 3000,
      });
      setIsOpen(false);
    } catch (error) {
      toast.error("Failed to remove avatar", {
        description: "Please try again later.",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleCancel = () => {
    setPreview(null);
    setSelectedFile(null);
    setIsOpen(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Update Avatar
          </DialogTitle>
          <DialogDescription>
            Upload a new profile picture or remove your current one.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Current Avatar */}
          {user?.profile?.avatarUrl && !preview && (
            <div className="text-center">
              <div className="inline-block relative">
                <img
                  src={user.profile.avatarUrl}
                  alt="Current avatar"
                  className="w-24 h-24 rounded-full object-cover border-2 border-border"
                />
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Current avatar
              </p>
            </div>
          )}

          {/* Preview */}
          {preview && (
            <div className="text-center">
              <div className="inline-block relative">
                <img
                  src={preview}
                  alt="Avatar preview"
                  className="w-24 h-24 rounded-full object-cover border-2 border-border"
                />
              </div>
              <p className="text-sm text-muted-foreground mt-2">Preview</p>
            </div>
          )}

          {/* File Input */}
          <div className="space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />

            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="w-full"
              disabled={isUploading}
            >
              <Upload className="mr-2 h-4 w-4" />
              Choose Image
            </Button>

            <div className="text-xs text-muted-foreground text-center">
              Supported formats: JPEG, PNG, GIF, WebP
              <br />
              Maximum size: 5MB
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-2">
            {selectedFile && (
              <Button
                onClick={handleUpload}
                disabled={isUploading}
                className="w-full"
              >
                {isUploading && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Upload Avatar
              </Button>
            )}

            {user?.profile?.avatarUrl && (
              <Button
                variant="destructive"
                onClick={handleRemoveAvatar}
                disabled={isUploading}
                className="w-full"
              >
                {isUploading && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Remove Avatar
              </Button>
            )}

            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={isUploading}
              className="w-full"
            >
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
