import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react'
import { UserTableRow } from './UserTableRow'
import type { User } from '@/types/auth'
import type { UserSortField } from '@/types/userManagement'

interface UserTableProps {
  users: User[]
  loading: boolean
  selectedUsers: string[]
  onUserSelect: (userId: string, selected: boolean) => void
  onSelectAll: (selected: boolean) => void
  onUserClick: (userId: string) => void
  onUserAction: (userId: string, action: string) => void
  sortField: UserSortField
  sortOrder: 'asc' | 'desc'
  onSort: (field: UserSortField) => void
}

export function UserTable({
  users,
  loading,
  selectedUsers,
  onUserSelect,
  onSelectAll,
  onUserClick,
  onUserAction,
  sortField,
  sortOrder,
  onSort
}: UserTableProps) {
  const allCurrentUsersSelected = users.length > 0 &&
    users.every(user => selectedUsers.includes(user.id))

  const someCurrentUsersSelected = users.some(user => selectedUsers.includes(user.id))

  const handleSelectAllCurrent = (checked: boolean) => {
    users.forEach(user => {
      onUserSelect(user.id, checked)
    })
  }

  const getSortIcon = (field: UserSortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4" />
    }
    return sortOrder === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
  }

  return (
    <Table className="table-elevated">
      <TableHeader className="bg-gradient-to-r from-muted/50 to-muted/30 backdrop-blur-sm">
        <TableRow className="hover:bg-transparent border-b border-border/40">
          <TableHead className="w-12 py-5 px-6 font-semibold text-foreground/90">
            <Checkbox
              checked={allCurrentUsersSelected}
              onCheckedChange={handleSelectAllCurrent}
              aria-label="Select all users"
              className={someCurrentUsersSelected && !allCurrentUsersSelected ? "data-[state=checked]:bg-primary" : ""}
            />
          </TableHead>
          <TableHead className="py-5 px-6 font-semibold text-foreground/90">
            <Button
              variant="ghost"
              onClick={() => onSort('email')}
              className="h-auto p-0 font-semibold text-foreground/90 hover:bg-primary/10 hover:text-primary transition-all duration-200 rounded-md px-2 py-1"
            >
              User
              {getSortIcon('email')}
            </Button>
          </TableHead>
          <TableHead className="py-5 px-6 font-semibold text-foreground/90">Role</TableHead>
          <TableHead className="py-5 px-6 font-semibold text-foreground/90">Status</TableHead>
          <TableHead className="py-5 px-6 font-semibold text-foreground/90">
            <Button
              variant="ghost"
              onClick={() => onSort('lastLoginAt')}
              className="h-auto p-0 font-semibold text-foreground/90 hover:bg-primary/10 hover:text-primary transition-all duration-200 rounded-md px-2 py-1"
            >
              Last Login
              {getSortIcon('lastLoginAt')}
            </Button>
          </TableHead>
          <TableHead className="py-5 px-6 font-semibold text-foreground/90">Activity</TableHead>
          <TableHead className="w-12 py-5 px-6"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.length === 0 ? (
          <TableRow>
            <TableCell colSpan={7} className="text-center py-8">
              <div className="text-muted-foreground">
                No users found matching your criteria.
              </div>
            </TableCell>
          </TableRow>
        ) : (
          users.map((user, index) => (
            <UserTableRow
              key={user.id}
              user={user}
              index={index}
              isSelected={selectedUsers.includes(user.id)}
              onSelect={(selected) => onUserSelect(user.id, selected)}
              onClick={() => onUserClick(user.id)}
              onAction={(action) => onUserAction(user.id, action)}
            />
          ))
        )}
      </TableBody>
    </Table>
  )
}
