import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { 
  UserCheck, 
  UserX, 
  Trash2, 
  Shield, 
  Mail, 
  X,
  AlertTriangle
} from 'lucide-react'

interface UserBulkActionsProps {
  selectedCount: number
  onAction: (action: string) => void
  onClear: () => void
}

export function UserBulkActions({ selectedCount, onAction, onClear }: UserBulkActionsProps) {
  const [selectedAction, setSelectedAction] = useState('')
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [pendingAction, setPendingAction] = useState('')

  const handleActionSelect = (action: string) => {
    setSelectedAction(action)
    
    // Actions that require confirmation
    const destructiveActions = ['delete', 'deactivate', 'remove_role']
    if (destructiveActions.includes(action)) {
      setPendingAction(action)
      setShowConfirmDialog(true)
    } else {
      executeAction(action)
    }
  }

  const executeAction = (action: string) => {
    onAction(action)
    setSelectedAction('')
    setShowConfirmDialog(false)
    setPendingAction('')
  }

  const getActionDetails = (action: string) => {
    switch (action) {
      case 'activate':
        return {
          title: 'Activate Users',
          description: `Are you sure you want to activate ${selectedCount} selected user(s)? They will be able to access the system.`,
          icon: <UserCheck className="h-4 w-4" />,
          variant: 'default' as const
        }
      case 'deactivate':
        return {
          title: 'Deactivate Users',
          description: `Are you sure you want to deactivate ${selectedCount} selected user(s)? They will lose access to the system.`,
          icon: <UserX className="h-4 w-4" />,
          variant: 'destructive' as const
        }
      case 'delete':
        return {
          title: 'Delete Users',
          description: `Are you sure you want to permanently delete ${selectedCount} selected user(s)? This action cannot be undone.`,
          icon: <Trash2 className="h-4 w-4" />,
          variant: 'destructive' as const
        }
      case 'verify_email':
        return {
          title: 'Verify Email Addresses',
          description: `Mark email addresses as verified for ${selectedCount} selected user(s).`,
          icon: <Mail className="h-4 w-4" />,
          variant: 'default' as const
        }
      case 'send_verification':
        return {
          title: 'Send Verification Emails',
          description: `Send verification emails to ${selectedCount} selected user(s).`,
          icon: <Mail className="h-4 w-4" />,
          variant: 'default' as const
        }
      case 'make_admin':
        return {
          title: 'Grant Admin Role',
          description: `Grant administrator privileges to ${selectedCount} selected user(s).`,
          icon: <Shield className="h-4 w-4" />,
          variant: 'default' as const
        }
      case 'remove_admin':
        return {
          title: 'Remove Admin Role',
          description: `Remove administrator privileges from ${selectedCount} selected user(s).`,
          icon: <Shield className="h-4 w-4" />,
          variant: 'destructive' as const
        }
      default:
        return {
          title: 'Confirm Action',
          description: `Perform action on ${selectedCount} selected user(s).`,
          icon: <AlertTriangle className="h-4 w-4" />,
          variant: 'default' as const
        }
    }
  }

  const actionDetails = getActionDetails(pendingAction)

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="gap-1">
            <span>{selectedCount} selected</span>
          </Badge>
          
          <Select value={selectedAction} onValueChange={handleActionSelect}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Choose action..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="activate">
                <div className="flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-green-500" />
                  Activate Users
                </div>
              </SelectItem>
              <SelectItem value="deactivate">
                <div className="flex items-center gap-2">
                  <UserX className="h-4 w-4 text-red-500" />
                  Deactivate Users
                </div>
              </SelectItem>
              <SelectItem value="verify_email">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-blue-500" />
                  Verify Email
                </div>
              </SelectItem>
              <SelectItem value="send_verification">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-blue-500" />
                  Send Verification
                </div>
              </SelectItem>
              <SelectItem value="make_admin">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-purple-500" />
                  Make Admin
                </div>
              </SelectItem>
              <SelectItem value="remove_admin">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-orange-500" />
                  Remove Admin
                </div>
              </SelectItem>
              <SelectItem value="delete">
                <div className="flex items-center gap-2">
                  <Trash2 className="h-4 w-4 text-red-500" />
                  Delete Users
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button variant="ghost" size="sm" onClick={onClear}>
          <X className="h-4 w-4 mr-1" />
          Clear Selection
        </Button>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {actionDetails.icon}
              {actionDetails.title}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionDetails.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowConfirmDialog(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => executeAction(pendingAction)}
              className={actionDetails.variant === 'destructive' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
            >
              {actionDetails.variant === 'destructive' && <AlertTriangle className="h-4 w-4 mr-2" />}
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
