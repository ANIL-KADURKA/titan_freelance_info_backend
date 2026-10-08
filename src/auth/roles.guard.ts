import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service.js';
import { ROLES_KEY } from './roles.decorator.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user?.id) {
      throw new UnauthorizedException('Authentication required');
    }

    // JwtStrategy already loaded the roles with the session check; query only
    // when the request was authenticated some other way.
    const roles: string[] = Array.isArray(user.roles)
      ? user.roles
      : (
          await this.prisma.userRole.findMany({
            where: { userId: user.id },
            include: { role: true },
          })
        ).map((entry) => entry.role.name);
    const isAuthorized = roles.some((role) => requiredRoles.includes(role));

    if (!isAuthorized) {
      throw new ForbiddenException(
        'You do not have permission to access this resource.',
      );
    }

    return true;
  }
}
