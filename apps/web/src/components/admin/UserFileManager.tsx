import { useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Files,
  Download,
  Trash2,
  FileText,
  Image,
  File,
  RefreshCw,
  Calendar,
  HardDrive,
} from "lucide-react";
import { useUserManagementStore } from "@/stores/userManagement";
import { formatDistanceToNow } from "date-fns";
import { formatBytes } from "@/lib/utils";
import type { UserFile } from "@/types/userManagement";

interface UserFileManagerProps {
  userId: string;
}

const fileTypeIcons: Record<string, typeof Image | typeof FileText | typeof File> = {
  "image/jpeg": Image,
  "image/png": Image,
  "image/gif": Image,
  "image/webp": Image,
  "application/pdf": FileText,
  "text/plain": FileText,
  "application/msword": FileText,
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    FileText,
  default: File,
};

const fileTypeBadgeColors: Record<string, string> = {
  avatar: "bg-blue-100 text-blue-800",
  document: "bg-green-100 text-green-800",
  default: "bg-gray-100 text-gray-800",
};

function FileIcon({ mimeType }: { mimeType: string }) {
  const IconComponent = fileTypeIcons[mimeType] || fileTypeIcons.default;
  return <IconComponent className="h-4 w-4" />;
}

function FileRow({
  file,
  onDelete,
  onDownload,
}: {
  file: UserFile;
  onDelete: (fileId: string) => void;
  onDownload: (fileId: string) => void;
}) {
  const handleDelete = async () => {
    await onDelete(file.id);
  };

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-2">
          <FileIcon mimeType={file.mimeType} />
          <div>
            <div className="font-medium">{file.originalName}</div>
            <div className="text-sm text-muted-foreground">{file.fileName}</div>
          </div>
        </div>
      </TableCell>

      <TableCell>
        <Badge
          variant="secondary"
          className={
            fileTypeBadgeColors[file.fileType] || fileTypeBadgeColors.default
          }
        >
          {file.fileType}
        </Badge>
      </TableCell>

      <TableCell>
        <div className="flex items-center gap-1 text-sm">
          <HardDrive className="h-3 w-3" />
          {formatBytes(file.fileSize)}
        </div>
      </TableCell>

      <TableCell>
        <div className="text-sm text-muted-foreground">{file.mimeType}</div>
      </TableCell>

      <TableCell>
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Calendar className="h-3 w-3" />
          {formatDistanceToNow(new Date(file.uploadedAt), { addSuffix: true })}
        </div>
      </TableCell>

      <TableCell>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDownload(file.id)}
          >
            <Download className="h-4 w-4" />
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete File</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete "{file.originalName}"? This
                  action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </TableCell>
    </TableRow>
  );
}

export function UserFileManager({ userId }: UserFileManagerProps) {
  const {
    userFiles,
    loadUserFiles,
    deleteUserFile,
    downloadUserFile,
    loading,
  } = useUserManagementStore();

  const isLoading = loading.userDetail;

  useEffect(() => {
    loadUserFiles(userId);
  }, [userId, loadUserFiles]);

  const handleRefresh = async () => {
    await loadUserFiles(userId);
  };

  const handleDeleteFile = async (fileId: string) => {
    await deleteUserFile(userId, fileId);
  };

  const handleDownloadFile = async (fileId: string) => {
    await downloadUserFile(fileId);
  };

  const activeFiles = userFiles?.filter((file) => file.isActive) || [];
  const totalSize = activeFiles.reduce((sum, file) => sum + file.fileSize, 0);
  const avatarFiles = activeFiles.filter((file) => file.fileType === "avatar");
  const documentFiles = activeFiles.filter(
    (file) => file.fileType === "document",
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">File Manager</h3>
          <p className="text-sm text-muted-foreground">
            Manage user uploaded files and documents
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={handleRefresh}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* File Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Files className="h-5 w-5 text-blue-600" />
              <div>
                <div className="text-2xl font-bold">{activeFiles.length}</div>
                <div className="text-sm text-muted-foreground">Total Files</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Image className="h-5 w-5 text-green-600" />
              <div>
                <div className="text-2xl font-bold">{avatarFiles.length}</div>
                <div className="text-sm text-muted-foreground">Avatars</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-purple-600" />
              <div>
                <div className="text-2xl font-bold">{documentFiles.length}</div>
                <div className="text-sm text-muted-foreground">Documents</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <HardDrive className="h-5 w-5 text-orange-600" />
              <div>
                <div className="text-2xl font-bold">
                  {formatBytes(totalSize)}
                </div>
                <div className="text-sm text-muted-foreground">Total Size</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Files Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Files className="h-5 w-5" />
            User Files
          </CardTitle>
          <CardDescription>
            {activeFiles.length > 0
              ? `${activeFiles.length} files uploaded by this user`
              : "No files uploaded yet"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : activeFiles.length === 0 ? (
            <div className="text-center py-8">
              <Files className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Files</h3>
              <p className="text-muted-foreground">
                This user hasn't uploaded any files yet.
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>File Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>MIME Type</TableHead>
                    <TableHead>Uploaded</TableHead>
                    <TableHead className="w-24">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeFiles.map((file) => (
                    <FileRow
                      key={file.id}
                      file={file}
                      onDelete={handleDeleteFile}
                      onDownload={handleDownloadFile}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* File Type Breakdown */}
      {activeFiles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>File Type Breakdown</CardTitle>
            <CardDescription>
              Distribution of files by MIME type
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(
                activeFiles.reduce(
                  (acc, file) => {
                    acc[file.mimeType] = (acc[file.mimeType] || 0) + 1;
                    return acc;
                  },
                  {} as Record<string, number>,
                ),
              ).map(([mimeType, count]) => (
                <div
                  key={mimeType}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <FileIcon mimeType={mimeType} />
                    <span className="text-sm">{mimeType}</span>
                  </div>
                  <Badge variant="secondary">{count}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
