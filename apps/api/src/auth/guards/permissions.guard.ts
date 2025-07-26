import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PERMISSIONS_KEY } from "../decorators/permissions.decorator";
import { RbacService } from "../rbac.service";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private rbacService: RbacService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user) {
      throw new ForbiddenException("User not authenticated");
    }

    // Check if user has any of the required permissions
    for (const permission of requiredPermissions) {
      const [resource, action] = permission.split(":");
      if (resource && action) {
        const hasPermission = await this.rbacService.userHasPermission(
          user.id,
          resource,
          action,
        );
        if (hasPermission) {
          return true;
        }
      }
    }

    throw new ForbiddenException(
      `Insufficient permissions. Required: ${requiredPermissions.join(" or ")}`,
    );
  }
}
