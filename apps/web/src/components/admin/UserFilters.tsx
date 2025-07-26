import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Filter, Calendar as CalendarIcon, X } from "lucide-react";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";

interface UserFiltersProps {
  filters: {
    search: string;
    role: string;
    status: string;
    emailVerified: string;
    dateRange: string;
  };
  onFiltersChange: (filters: {
    search: string;
    role: string;
    status: string;
    emailVerified: string;
    dateRange: string;
  }) => void;
}

export function UserFilters({ filters, onFiltersChange }: UserFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  const activeFiltersCount = Object.values(filters).filter(
    (value) => value !== "all",
  ).length;

  const handleDateRangeChange = (range: DateRange | undefined) => {
    setDateRange(range);
    if (range?.from && range?.to) {
      onFiltersChange({
        ...filters,
        dateRange: `${format(range.from, "yyyy-MM-dd")}_${format(range.to, "yyyy-MM-dd")}`,
      });
    }
  };

  const clearFilters = () => {
    onFiltersChange({
      search: filters.search,
      role: "all",
      status: "all",
      emailVerified: "all",
      dateRange: "all",
    });
    setDateRange(undefined);
  };

  const clearSpecificFilter = (filterKey: string) => {
    onFiltersChange({
      ...filters,
      [filterKey]: "all",
    });
    if (filterKey === "dateRange") {
      setDateRange(undefined);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="relative">
            <Filter className="h-4 w-4 mr-2" />
            Advanced Filters
            {activeFiltersCount > 0 && (
              <Badge
                variant="destructive"
                className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
              >
                {activeFiltersCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="end">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Advanced Filters</h4>
              {activeFiltersCount > 0 && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="h-4 w-4 mr-1" />
                  Clear All
                </Button>
              )}
            </div>

            {/* Email Verification Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Email Verification</label>
              <Select
                value={filters.emailVerified}
                onValueChange={(value) =>
                  onFiltersChange({ ...filters, emailVerified: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Email verification status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  <SelectItem value="verified">Verified Only</SelectItem>
                  <SelectItem value="unverified">Unverified Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date Range Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Registration Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange?.from ? (
                      dateRange.to ? (
                        <>
                          {format(dateRange.from, "LLL dd, y")} -{" "}
                          {format(dateRange.to, "LLL dd, y")}
                        </>
                      ) : (
                        format(dateRange.from, "LLL dd, y")
                      )
                    ) : (
                      <span>Pick a date range</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange?.from}
                    selected={dateRange}
                    onSelect={handleDateRangeChange}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Quick Date Filters */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Quick Filters</label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const today = new Date();
                    const lastWeek = new Date(
                      today.getTime() - 7 * 24 * 60 * 60 * 1000,
                    );
                    handleDateRangeChange({ from: lastWeek, to: today });
                  }}
                >
                  Last 7 days
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const today = new Date();
                    const lastMonth = new Date(
                      today.getTime() - 30 * 24 * 60 * 60 * 1000,
                    );
                    handleDateRangeChange({ from: lastMonth, to: today });
                  }}
                >
                  Last 30 days
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const today = new Date();
                    const lastQuarter = new Date(
                      today.getTime() - 90 * 24 * 60 * 60 * 1000,
                    );
                    handleDateRangeChange({ from: lastQuarter, to: today });
                  }}
                >
                  Last 90 days
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const today = new Date();
                    const lastYear = new Date(
                      today.getTime() - 365 * 24 * 60 * 60 * 1000,
                    );
                    handleDateRangeChange({ from: lastYear, to: today });
                  }}
                >
                  Last year
                </Button>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Active Filter Tags */}
      {activeFiltersCount > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          {filters.role !== "all" && (
            <Badge variant="secondary" className="gap-1">
              Role: {filters.role}
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 text-muted-foreground hover:text-foreground"
                onClick={() => clearSpecificFilter("role")}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          )}
          {filters.status !== "all" && (
            <Badge variant="secondary" className="gap-1">
              Status: {filters.status}
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 text-muted-foreground hover:text-foreground"
                onClick={() => clearSpecificFilter("status")}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          )}
          {filters.emailVerified !== "all" && (
            <Badge variant="secondary" className="gap-1">
              Email: {filters.emailVerified}
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 text-muted-foreground hover:text-foreground"
                onClick={() => clearSpecificFilter("emailVerified")}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          )}
          {filters.dateRange !== "all" && (
            <Badge variant="secondary" className="gap-1">
              Date Range
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 text-muted-foreground hover:text-foreground"
                onClick={() => clearSpecificFilter("dateRange")}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
