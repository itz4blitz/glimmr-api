import { useState } from 'react'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { 
  Filter, 
  X,
  RotateCcw,
  Check
} from 'lucide-react'
import type { UserFilters } from '@/types/userManagement'

interface MobileFiltersDrawerProps {
  filters: UserFilters
  onFiltersChange: (filters: Partial<UserFilters>) => void
  onReset: () => void
  children: React.ReactNode
}

const roleOptions = [
  { value: 'all', label: 'All Roles' },
  { value: 'user', label: 'User' },
  { value: 'admin', label: 'Admin' },
  { value: 'super_admin', label: 'Super Admin' }
]

const statusOptions = [
  { value: 'all', label: 'All Status' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' }
]

const emailVerifiedOptions = [
  { value: 'all', label: 'All Users' },
  { value: 'verified', label: 'Verified' },
  { value: 'unverified', label: 'Unverified' }
]

const dateRangeOptions = [
  { value: 'all', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'quarter', label: 'This Quarter' },
  { value: 'year', label: 'This Year' }
]

export function MobileFiltersDrawer({ 
  filters, 
  onFiltersChange, 
  onReset, 
  children 
}: MobileFiltersDrawerProps) {
  const [open, setOpen] = useState(false)
  const [localFilters, setLocalFilters] = useState<UserFilters>(filters)

  const handleApply = () => {
    onFiltersChange(localFilters)
    setOpen(false)
  }

  const handleReset = () => {
    const resetFilters: UserFilters = {
      search: '',
      role: 'all',
      status: 'all',
      emailVerified: 'all',
      dateRange: 'all'
    }
    setLocalFilters(resetFilters)
    onReset()
    setOpen(false)
  }

  const handleCancel = () => {
    setLocalFilters(filters)
    setOpen(false)
  }

  const updateFilter = (key: keyof UserFilters, value: string) => {
    setLocalFilters(prev => ({
      ...prev,
      [key]: value
    }))
  }

  const hasActiveFilters = () => {
    return (
      localFilters.role !== 'all' ||
      localFilters.status !== 'all' ||
      localFilters.emailVerified !== 'all' ||
      localFilters.dateRange !== 'all'
    )
  }

  const getActiveFilterCount = () => {
    let count = 0
    if (localFilters.role !== 'all') count++
    if (localFilters.status !== 'all') count++
    if (localFilters.emailVerified !== 'all') count++
    if (localFilters.dateRange !== 'all') count++
    return count
  }

  const getFilterLabel = (options: any[], value: string) => {
    return options.find(option => option.value === value)?.label || value
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        {children}
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
            {getActiveFilterCount() > 0 && (
              <Badge variant="secondary" className="ml-2">
                {getActiveFilterCount()}
              </Badge>
            )}
          </DrawerTitle>
          <DrawerDescription>
            Filter users by role, status, and other criteria
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-4 space-y-6">
          {/* Role Filter */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Role</Label>
            <Select
              value={localFilters.role}
              onValueChange={(value) => updateFilter('role', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roleOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center justify-between w-full">
                      <span>{option.label}</span>
                      {localFilters.role === option.value && (
                        <Check className="h-4 w-4 ml-2" />
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Status Filter */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Status</Label>
            <Select
              value={localFilters.status}
              onValueChange={(value) => updateFilter('status', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center justify-between w-full">
                      <span>{option.label}</span>
                      {localFilters.status === option.value && (
                        <Check className="h-4 w-4 ml-2" />
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Email Verification Filter */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Email Verification</Label>
            <Select
              value={localFilters.emailVerified}
              onValueChange={(value) => updateFilter('emailVerified', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {emailVerifiedOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center justify-between w-full">
                      <span>{option.label}</span>
                      {localFilters.emailVerified === option.value && (
                        <Check className="h-4 w-4 ml-2" />
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Date Range Filter */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Date Range</Label>
            <Select
              value={localFilters.dateRange}
              onValueChange={(value) => updateFilter('dateRange', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {dateRangeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center justify-between w-full">
                      <span>{option.label}</span>
                      {localFilters.dateRange === option.value && (
                        <Check className="h-4 w-4 ml-2" />
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Active Filters Summary */}
          {hasActiveFilters() && (
            <>
              <Separator />
              <div className="space-y-3">
                <Label className="text-base font-semibold">Active Filters</Label>
                <div className="flex flex-wrap gap-2">
                  {localFilters.role !== 'all' && (
                    <Badge variant="secondary" className="gap-1">
                      Role: {getFilterLabel(roleOptions, localFilters.role)}
                      <X 
                        className="h-3 w-3 cursor-pointer" 
                        onClick={() => updateFilter('role', 'all')}
                      />
                    </Badge>
                  )}
                  {localFilters.status !== 'all' && (
                    <Badge variant="secondary" className="gap-1">
                      Status: {getFilterLabel(statusOptions, localFilters.status)}
                      <X 
                        className="h-3 w-3 cursor-pointer" 
                        onClick={() => updateFilter('status', 'all')}
                      />
                    </Badge>
                  )}
                  {localFilters.emailVerified !== 'all' && (
                    <Badge variant="secondary" className="gap-1">
                      Email: {getFilterLabel(emailVerifiedOptions, localFilters.emailVerified)}
                      <X 
                        className="h-3 w-3 cursor-pointer" 
                        onClick={() => updateFilter('emailVerified', 'all')}
                      />
                    </Badge>
                  )}
                  {localFilters.dateRange !== 'all' && (
                    <Badge variant="secondary" className="gap-1">
                      Date: {getFilterLabel(dateRangeOptions, localFilters.dateRange)}
                      <X 
                        className="h-3 w-3 cursor-pointer" 
                        onClick={() => updateFilter('dateRange', 'all')}
                      />
                    </Badge>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <DrawerFooter className="flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={!hasActiveFilters()}
            className="flex-1"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
          <Button variant="outline" onClick={handleCancel} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleApply} className="flex-1">
            Apply
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
