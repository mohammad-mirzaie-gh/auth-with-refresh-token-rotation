import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '../type/jwt-payload.type';
import { refreshTokenCookies } from '../utils/cookie.title';
import { RedisService } from 'src/modules/redis/redis.service';
import { bcryptCompare } from 'src/common/utils/bcrypt';
import { ErrorMessages } from 'src/constant/message.errors';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(
    private readonly prisma: PrismaService,
    configService: ConfigService,
    private redisService: RedisService,
    private prismaService: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req: Request) => req.cookies?.[refreshTokenCookies],
      ]),
      secretOrKey: configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      ignoreExpiration: false,
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: JwtPayload) {
    const refreshToken =
      ExtractJwt.fromAuthHeaderAsBearerToken()(req) ||
      req.cookies?.[refreshTokenCookies];
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is missing');
    }

    let refreshTokenHashed: string;

    const refreshTokenInRedis = await this.redisService.get(
      this.redisService.redisKeys({
        userId: payload.sub,
        sessionId: payload.sessionId,
      }),
    );

    const session = await this.prisma.authSession.findFirst({
      where: {
        id: payload.sessionId,
        userId: payload.sub,
        expiresAt: {
          gt: new Date(),
        },
      },
      include: {
        user: true,
      },
    });

    if (!session || !session.user) {
      throw new UnauthorizedException('Invalid or expired refresh session');
    }

    const isValid = await bcryptCompare(refreshToken, refreshTokenHashed);

    if (!isValid) {
      await this.removeSession({ userId: sub, sessionId });
      throw new UnauthorizedException('Invalid refresh token');
    }

    return {
      sub: session.user.id,
      email: session.user.email,
      sessionId: session.id,
      refreshToken,
    };
  }
}
