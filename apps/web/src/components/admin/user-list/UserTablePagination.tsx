import { Button } from '@/components/ui/button'
import {
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

interface PaginationData {
  page: number
  limit: number
  total: number
  totalPages: number
}

interface UserTablePaginationProps {
  pagination: PaginationData
  loading: boolean
  onPageChange: (page: number) => void
}

export function UserTablePagination({
  pagination,
  loading,
  onPageChange
}: UserTablePaginationProps) {
  if (pagination.totalPages <= 1) {
    return null
  }

  return (
    <div className="flex items-center justify-between p-6 bg-gradient-to-r from-muted/20 to-muted/10 border-t border-border/20">
      <div className="text-sm text-muted-foreground font-medium">
        Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} users
      </div>
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(pagination.page - 1)}
          disabled={pagination.page === 1 || loading}
          className="shadow-sm hover:shadow-md transition-all duration-200"
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>
        <div className="text-sm font-medium bg-background/80 px-3 py-1 rounded-full border border-border/30">
          {pagination.page} / {pagination.totalPages}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(pagination.page + 1)}
          disabled={pagination.page === pagination.totalPages || loading}
          className="shadow-sm hover:shadow-md transition-all duration-200"
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
