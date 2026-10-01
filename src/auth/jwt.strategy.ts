import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service.js';

export type JwtPayload = {
  sub: string;
  email: string;
  type?: 'access' | 'refresh';
  /** User.tokenVersion when the token was issued; absent on older tokens. */
  ver?: number;
  iat?: number;
  exp?: number;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        configService.get<string>('JWT_SECRET') ?? 'development-secret',
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { tokenVersion: true, deletedAt: true },
    });

    // Changing or resetting the password bumps tokenVersion, which signs out
    // every token issued before it.
    if (!user || user.deletedAt || (payload.ver ?? 0) !== user.tokenVersion) {
      throw new UnauthorizedException('Session expired. Please sign in again.');
    }

    return {
      id: payload.sub,
      email: payload.email,
      type: payload.type ?? 'access',
    };
  }
}
