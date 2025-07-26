import { useState, useEffect } from "react";
import { useUserManagementStore } from "@/stores/userManagement";
import { UserDetailDialog } from "./UserDetailDialog";
import { UserTable } from "./user-list/UserTable";
import { UserTablePagination } from "./user-list/UserTablePagination";
import type { UserSortField } from "@/types/userManagement";

interface UserListProps {
  selectedUsers: string[];
  onUserSelect: (userId: string, selected: boolean) => void;
  onUserEdit?: (userId: string) => void;
}

export function UserList({
  selectedUsers,
  onUserSelect,
  onUserEdit,
}: UserListProps) {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<UserSortField>("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const {
    users,
    loading,
    error,
    pagination,
    loadUsers,
    setPagination,
    activateUser,
    deactivateUser,
    deleteUser,
  } = useUserManagementStore();

  // Load users when component mounts or sort changes
  useEffect(() => {
    const searchParams = {
      sortBy: sortField,
      sortOrder: sortOrder,
    };
    loadUsers(searchParams);
  }, [sortField, sortOrder, loadUsers]);

  const handleSort = (field: UserSortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const handleUserAction = async (userId: string, action: string) => {
    try {
      switch (action) {
        case "edit":
          if (onUserEdit) {
            onUserEdit(userId);
          } else {
            setSelectedUserId(userId);
          }
          break;
        case "activate":
          await activateUser(userId);
          break;
        case "deactivate":
          await deactivateUser(userId);
          break;
        case "delete": {
          const confirmed = window.confirm(
            "Are you sure you want to delete this user?",
          );
          if (confirmed) {
            await deleteUser(userId);
          }
          break;
        }
      }
    } catch (error) {
      console.error(`Failed to ${action} user:`, error);
    }
  };

  const handlePageChange = (page: number) => {
    setPagination({ page });
  };

  return (
    <div className="bg-background/95 backdrop-blur-sm">
      {error.users && (
        <div className="m-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
          <p className="text-sm text-destructive">{error.users}</p>
        </div>
      )}

      <div className="overflow-hidden">
        <UserTable
          users={users}
          selectedUsers={selectedUsers}
          onUserSelect={onUserSelect}
          onUserClick={setSelectedUserId}
          onUserAction={handleUserAction}
          sortField={sortField}
          sortOrder={sortOrder}
          onSort={handleSort}
        />

        <UserTablePagination
          pagination={pagination}
          loading={loading.users}
          onPageChange={handlePageChange}
        />
      </div>

      <UserDetailDialog
        userId={selectedUserId}
        open={!!selectedUserId}
        onOpenChange={(open) => !open && setSelectedUserId(null)}
      />
    </div>
  );
}
