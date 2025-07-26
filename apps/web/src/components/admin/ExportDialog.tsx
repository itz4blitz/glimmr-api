import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

import { Download, FileText, Table, Code, Loader2 } from "lucide-react";
import { userManagementApi } from "@/services/userManagement";
import { useUserManagementStore } from "@/stores/userManagement";
import { toast } from "sonner";
import type { ExportOptions } from "@/types/userManagement";

interface ExportDialogProps {
  children: React.ReactNode;
}

const exportFormats = [
  {
    value: "csv",
    label: "CSV",
    icon: Table,
    description: "Comma-separated values",
  },
  {
    value: "excel",
    label: "Excel",
    icon: FileText,
    description: "Microsoft Excel format",
  },
  {
    value: "json",
    label: "JSON",
    icon: Code,
    description: "JavaScript Object Notation",
  },
];

const availableFields = [
  { key: "id", label: "User ID", category: "basic" },
  { key: "email", label: "Email", category: "basic" },
  { key: "firstName", label: "First Name", category: "basic" },
  { key: "lastName", label: "Last Name", category: "basic" },
  { key: "role", label: "Role", category: "basic" },
  { key: "isActive", label: "Active Status", category: "basic" },
  { key: "emailVerified", label: "Email Verified", category: "basic" },
  { key: "createdAt", label: "Created Date", category: "basic" },
  { key: "updatedAt", label: "Updated Date", category: "basic" },
  { key: "lastLoginAt", label: "Last Login", category: "basic" },
  { key: "profile.company", label: "Company", category: "profile" },
  { key: "profile.jobTitle", label: "Job Title", category: "profile" },
  { key: "profile.phoneNumber", label: "Phone Number", category: "profile" },
  { key: "profile.city", label: "City", category: "profile" },
  { key: "profile.country", label: "Country", category: "profile" },
  { key: "profile.timezone", label: "Timezone", category: "profile" },
  { key: "activityCount", label: "Activity Count", category: "stats" },
  { key: "fileCount", label: "File Count", category: "stats" },
];

const fieldCategories = [
  { key: "basic", label: "Basic Information" },
  { key: "profile", label: "Profile Data" },
  { key: "stats", label: "Statistics" },
];

export function ExportDialog({ children }: ExportDialogProps) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<"csv" | "excel" | "json">("csv");
  const [selectedFields, setSelectedFields] = useState<string[]>([
    "id",
    "email",
    "firstName",
    "lastName",
    "role",
    "isActive",
    "createdAt",
  ]);
  const [isExporting, setIsExporting] = useState(false);

  const { filters } = useUserManagementStore();

  const handleFieldToggle = (fieldKey: string) => {
    setSelectedFields((prev) =>
      prev.includes(fieldKey)
        ? prev.filter((f) => f !== fieldKey)
        : [...prev, fieldKey],
    );
  };

  const handleSelectAllInCategory = (category: string, selected: boolean) => {
    const categoryFields = availableFields
      .filter((field) => field.category === category)
      .map((field) => field.key);

    if (selected) {
      setSelectedFields((prev) => [...new Set([...prev, ...categoryFields])]);
    } else {
      setSelectedFields((prev) =>
        prev.filter((field) => !categoryFields.includes(field)),
      );
    }
  };

  const handleExport = async () => {
    if (selectedFields.length === 0) {
      toast.error("Please select at least one field to export");
      return;
    }

    setIsExporting(true);

    try {
      const exportOptions: ExportOptions = {
        format,
        fields: selectedFields,
        filters: filters,
      };

      const blob = await userManagementApi.exportUsers(exportOptions);

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;

      const timestamp = new Date().toISOString().split("T")[0];
      const extension = format === "excel" ? "xlsx" : format;
      link.download = `users-export-${timestamp}.${extension}`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success("Export completed successfully");
      setOpen(false);
    } catch (error: any) {
      toast.error("Export failed: " + error.message);
    } finally {
      setIsExporting(false);
    }
  };

  const getSelectedFormatInfo = () => {
    return exportFormats.find((f) => f.value === format);
  };

  const formatInfo = getSelectedFormatInfo();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Users
          </DialogTitle>
          <DialogDescription>
            Export user data in your preferred format with selected fields
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Format Selection */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Export Format</Label>
            <Select
              value={format}
              onValueChange={(value: any) => setFormat(value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {exportFormats.map((fmt) => {
                  const IconComponent = fmt.icon;
                  return (
                    <SelectItem key={fmt.value} value={fmt.value}>
                      <div className="flex items-center gap-2">
                        <IconComponent className="h-4 w-4" />
                        <div>
                          <div className="font-medium">{fmt.label}</div>
                          <div className="text-xs text-muted-foreground">
                            {fmt.description}
                          </div>
                        </div>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>

            {formatInfo && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <formatInfo.icon className="h-4 w-4" />
                <span>{formatInfo.description}</span>
              </div>
            )}
          </div>

          <Separator />

          {/* Field Selection */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">
                Fields to Export
              </Label>
              <div className="text-sm text-muted-foreground">
                {selectedFields.length} of {availableFields.length} selected
              </div>
            </div>

            <div className="space-y-4">
              {fieldCategories.map((category) => {
                const categoryFields = availableFields.filter(
                  (field) => field.category === category.key,
                );
                const selectedInCategory = categoryFields.filter((field) =>
                  selectedFields.includes(field.key),
                );
                const allSelected =
                  selectedInCategory.length === categoryFields.length;
                const someSelected = selectedInCategory.length > 0;

                return (
                  <div key={category.key} className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={(checked) =>
                          handleSelectAllInCategory(
                            category.key,
                            checked as boolean,
                          )
                        }
                        className={
                          someSelected && !allSelected
                            ? "data-[state=checked]:bg-primary"
                            : ""
                        }
                      />
                      <Label className="font-medium">{category.label}</Label>
                      <span className="text-sm text-muted-foreground">
                        ({selectedInCategory.length}/{categoryFields.length})
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 ml-6">
                      {categoryFields.map((field) => (
                        <div
                          key={field.key}
                          className="flex items-center gap-2"
                        >
                          <Checkbox
                            checked={selectedFields.includes(field.key)}
                            onCheckedChange={() => handleFieldToggle(field.key)}
                          />
                          <Label className="text-sm">{field.label}</Label>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <Separator />

          {/* Export Summary */}
          <div className="space-y-2">
            <Label className="text-base font-semibold">Export Summary</Label>
            <div className="text-sm text-muted-foreground space-y-1">
              <div>Format: {formatInfo?.label}</div>
              <div>Fields: {selectedFields.length} selected</div>
              <div>
                Filters:{" "}
                {Object.values(filters).filter((v) => v && v !== "all").length >
                0
                  ? "Applied"
                  : "None"}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isExporting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={isExporting || selectedFields.length === 0}
          >
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Export
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
