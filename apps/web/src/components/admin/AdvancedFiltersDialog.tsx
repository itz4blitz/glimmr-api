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
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Filter, Calendar as CalendarIcon, X, RotateCcw } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { AdvancedFilters } from "@/types/userManagement";
import { UserRole } from "@/types/auth";

interface AdvancedFiltersDialogProps {
  filters: AdvancedFilters;
  onFiltersChange: (filters: AdvancedFilters) => void;
  children: React.ReactNode;
}

const roles: { value: UserRole; label: string }[] = [
  { value: UserRole.USER, label: "User" },
  { value: UserRole.ADMIN, label: "Admin" },
  { value: UserRole.SUPER_ADMIN, label: "Super Admin" },
];

const statuses = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

const dateFields = [
  { value: "createdAt", label: "Created Date" },
  { value: "lastLoginAt", label: "Last Login Date" },
];

export function AdvancedFiltersDialog({
  filters,
  onFiltersChange,
  children,
}: AdvancedFiltersDialogProps) {
  const [open, setOpen] = useState(false);
  const [localFilters, setLocalFilters] = useState<AdvancedFilters>(filters);

  const handleApply = () => {
    onFiltersChange(localFilters);
    setOpen(false);
  };

  const handleReset = () => {
    const resetFilters: AdvancedFilters = {
      roles: [],
      statuses: [],
      emailVerified: null,
      dateRange: {
        field: "createdAt",
        start: null,
        end: null,
      },
      hasActivity: null,
      hasFiles: null,
    };
    setLocalFilters(resetFilters);
  };

  const handleCancel = () => {
    setLocalFilters(filters);
    setOpen(false);
  };

  const toggleRole = (role: UserRole) => {
    setLocalFilters((prev) => ({
      ...prev,
      roles: prev.roles.includes(role)
        ? prev.roles.filter((r) => r !== role)
        : [...prev.roles, role],
    }));
  };

  const toggleStatus = (status: "active" | "inactive") => {
    setLocalFilters((prev) => ({
      ...prev,
      statuses: prev.statuses.includes(status)
        ? prev.statuses.filter((s) => s !== status)
        : [...prev.statuses, status],
    }));
  };

  const hasActiveFilters = () => {
    return (
      localFilters.roles.length > 0 ||
      localFilters.statuses.length > 0 ||
      localFilters.emailVerified !== null ||
      localFilters.dateRange.start !== null ||
      localFilters.dateRange.end !== null ||
      localFilters.hasActivity !== null ||
      localFilters.hasFiles !== null
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Advanced Filters
          </DialogTitle>
          <DialogDescription>
            Apply advanced filtering criteria to narrow down the user list
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Roles */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Roles</Label>
            <div className="flex flex-wrap gap-2">
              {roles.map((role) => (
                <Badge
                  key={role.value}
                  variant={
                    localFilters.roles.includes(role.value)
                      ? "default"
                      : "outline"
                  }
                  className="cursor-pointer"
                  onClick={() => toggleRole(role.value)}
                >
                  {role.label}
                  {localFilters.roles.includes(role.value) && (
                    <X className="h-3 w-3 ml-1" />
                  )}
                </Badge>
              ))}
            </div>
          </div>

          <Separator />

          {/* Status */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Account Status</Label>
            <div className="flex flex-wrap gap-2">
              {statuses.map((status) => (
                <Badge
                  key={status.value}
                  variant={
                    localFilters.statuses.includes(status.value as "active" | "inactive")
                      ? "default"
                      : "outline"
                  }
                  className="cursor-pointer"
                  onClick={() => toggleStatus(status.value as "active" | "inactive")}
                >
                  {status.label}
                  {localFilters.statuses.includes(status.value as "active" | "inactive") && (
                    <X className="h-3 w-3 ml-1" />
                  )}
                </Badge>
              ))}
            </div>
          </div>

          <Separator />

          {/* Email Verification */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">
              Email Verification
            </Label>
            <div className="flex items-center gap-4">
              <div className="flex items-center space-x-2">
                <Switch
                  checked={localFilters.emailVerified === true}
                  onCheckedChange={(checked) =>
                    setLocalFilters((prev) => ({
                      ...prev,
                      emailVerified: checked ? true : null,
                    }))
                  }
                />
                <Label>Verified only</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  checked={localFilters.emailVerified === false}
                  onCheckedChange={(checked) =>
                    setLocalFilters((prev) => ({
                      ...prev,
                      emailVerified: checked ? false : null,
                    }))
                  }
                />
                <Label>Unverified only</Label>
              </div>
            </div>
          </div>

          <Separator />

          {/* Date Range */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Date Range</Label>

            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Date Field</Label>
                <Select
                  value={localFilters.dateRange.field}
                  onValueChange={(value) =>
                    setLocalFilters((prev) => ({
                      ...prev,
                      dateRange: { ...prev.dateRange, field: value as "createdAt" | "lastLoginAt" },
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {dateFields.map((field) => (
                      <SelectItem key={field.value} value={field.value}>
                        {field.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !localFilters.dateRange.start &&
                            "text-muted-foreground",
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {localFilters.dateRange.start ? (
                          format(localFilters.dateRange.start, "PPP")
                        ) : (
                          <span>Pick a date</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={localFilters.dateRange.start || undefined}
                        onSelect={(date) =>
                          setLocalFilters((prev) => ({
                            ...prev,
                            dateRange: {
                              ...prev.dateRange,
                              start: date || null,
                            },
                          }))
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !localFilters.dateRange.end &&
                            "text-muted-foreground",
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {localFilters.dateRange.end ? (
                          format(localFilters.dateRange.end, "PPP")
                        ) : (
                          <span>Pick a date</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={localFilters.dateRange.end || undefined}
                        onSelect={(date) =>
                          setLocalFilters((prev) => ({
                            ...prev,
                            dateRange: { ...prev.dateRange, end: date || null },
                          }))
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Activity and Files */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">
              Additional Criteria
            </Label>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Has Activity</Label>
                  <p className="text-sm text-muted-foreground">
                    Users with recorded activity logs
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={localFilters.hasActivity === true}
                    onCheckedChange={(checked) =>
                      setLocalFilters((prev) => ({
                        ...prev,
                        hasActivity: checked ? true : null,
                      }))
                    }
                  />
                  <Label className="text-sm">Yes</Label>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Has Files</Label>
                  <p className="text-sm text-muted-foreground">
                    Users with uploaded files
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={localFilters.hasFiles === true}
                    onCheckedChange={(checked) =>
                      setLocalFilters((prev) => ({
                        ...prev,
                        hasFiles: checked ? true : null,
                      }))
                    }
                  />
                  <Label className="text-sm">Yes</Label>
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={!hasActiveFilters()}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button onClick={handleApply}>Apply Filters</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
