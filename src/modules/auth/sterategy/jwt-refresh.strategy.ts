import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '../type/jwt-payload.type';
import { RedisService } from 'src/modules/redis/redis.service';
import { bcryptCompare } from 'src/common/utils/bcrypt';
import { refreshTokenCookies } from '../utils/cookie.title';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req: Request) => req?.cookies?.[refreshTokenCookies],
      ]),
      secretOrKey: configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      ignoreExpiration: false,
      passReqToCallback: true,
    });
  }

  private extractToken(req: Request): string | null {
    return (
      ExtractJwt.fromAuthHeaderAsBearerToken()(req) ||
      req?.cookies?.[refreshTokenCookies] ||
      null
    );
  }

  async validate(req: Request, payload: JwtPayload) {
    const refreshToken = this.extractToken(req);

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token missing');
    }

    const redisKey = this.redis.redisKeys({
      userId: payload.sub,
      sessionId: payload.sessionId,
    });

    // ✅ 1. check session existence in Redis
    const exists = await this.redis.get(redisKey);

    if (!exists) {
      throw new UnauthorizedException('Session expired');
    }

    // ✅ 2. get refresh hash from DB
    const session = await this.prisma.authSession.findUnique({
      where: { id: payload.sessionId },
      select: {
        refreshHash: true,
        userId: true,
        expiresAt: true,
      },
    });

    if (
      !session ||
      session.userId !== payload.sub ||
      session.expiresAt <= new Date()
    ) {
      throw new UnauthorizedException('Invalid refresh session');
    }

    // ✅ 3. compare refresh token
    const isValid = await bcryptCompare(refreshToken, session.refreshHash);

    if (!isValid) {
      // revoke session (possible token theft)
      await this.prisma.authSession.delete({
        where: { id: payload.sessionId },
      });

      await this.redis.delete(redisKey);

      throw new UnauthorizedException('Invalid refresh token');
    }

    return {
      sub: payload.sub,
      email: payload.email,
      sessionId: payload.sessionId,
      refreshToken,
    };
  }
}
