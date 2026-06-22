import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { LoginPasswordDto } from './dto/body.dto';
import { ErrorMessages } from 'src/constant/message.errors';
import { bcryptCompare, bcryptHash } from 'src/common/utils/bcrypt';
import { randomUUID } from 'crypto';
import { JwtPayload } from './type/jwt-payload.type';
import { DeviceType } from 'generated/prisma';

@Injectable()
export class AuthService {
  constructor(
    private prismaService: PrismaService,
    private redisService: RedisService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  //////////////////
  /// MAIN SERVICES
  //////////////////
  async login({ device, email, password }: LoginPasswordDto) {
    const user = await this.prismaService.user.findUnique({ where: { email } });

    if (!user) {
      throw new UnauthorizedException(ErrorMessages.USER.NOT_FOUND);
    }

    const comparePassword = await bcryptCompare(password, user.hashedPassword);

    if (!comparePassword) {
      throw new UnauthorizedException(
        ErrorMessages.AUTH.PASSWORD_OR_EMAIL_INCORRECT,
      );
    }

    const sessionId = randomUUID();

    const tokens = await this.createSession({
      userId: user.id,
      sessionId,
      device,
      email: user.email,
    });

    return tokens;
  }

  //////////////////
  /// SUB SERVICES
  //////////////////

  async createSession({
    userId,
    sessionId,
    device,
    email,
  }: {
    userId: number;
    sessionId: string;
    device: DeviceType;
    email: string;
  }) {
    // remove expire session
    await this.removeExpiredSessions(userId);

    // make tokens
    const refreshToken = this.signRefreshToken({
      email,
      sessionId,
      sub: userId,
    });
    const accessToken = this.signAccessToken({
      email,
      sessionId,
      sub: userId,
    });

    // make hashedToken
    const hashedRefreshToken = await bcryptHash(refreshToken);
    const sessionsToRemoveFromRedis: string[] = [];
    const tokens = await this.prismaService.$transaction(
      async (tx) => {
        const sessions = await tx.authSession.count({
          where: { userId },
        });

        if (sessions >= 5) {
          const oldSession = await tx.authSession.findFirst({
            where: { userId },
            orderBy: { createdAt: 'asc' },
          });

          if (oldSession) {
            // remove old session ( Session limit 5 )
            await tx.authSession.deleteMany({
              where: { userId, id: oldSession.id },
            });

            sessionsToRemoveFromRedis.push(oldSession.id);
          }
        }

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        await tx.authSession.create({
          data: {
            id: sessionId,
            userId,
            expiresAt,
            deviceType: device,
            refreshHash: hashedRefreshToken,
          },
        });

        return { refreshToken, accessToken };
      },
      // For PostgreSQL, consider using:
      // { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    await Promise.all(
      sessionsToRemoveFromRedis.map((oldSessionId) =>
        this.redisService.delete(
          this.redisService.redisKeys({ userId, sessionId: oldSessionId }),
        ),
      ),
    );

    await this.redisService.set(
      this.redisService.redisKeys({ userId, sessionId }),
      hashedRefreshToken,
      7 * 24 * 60 * 60,
    );
    return tokens;
  }

  async removeExpiredSessions(userId: number) {
    const now = new Date();

    const expiredSessions = await this.prismaService.authSession.findMany({
      where: {
        userId,
        expiresAt: { lt: now },
      },
      select: {
        id: true,
      },
    });

    if (!expiredSessions.length) {
      return { count: 0 };
    }

    const sessionIds = expiredSessions.map((session) => session.id);

    // Deleting DB records
    const result = await this.prismaService.authSession.deleteMany({
      where: {
        userId,
        id: {
          in: sessionIds,
        },
      },
    });

    // Deleting Redis records
    await Promise.all(
      sessionIds.map((sessionId) =>
        this.redisService.delete(
          this.redisService.redisKeys({ userId, sessionId }),
        ),
      ),
    );

    return {
      count: result.count,
      sessionIds,
    };
  }

  async removeSession({
    userId,
    sessionId,
  }: {
    userId: number;
    sessionId: string;
  }) {
    // Deleting DB record
    await this.prismaService.authSession.deleteMany({
      where: { userId, id: sessionId },
    });

    // Deleting Redis record
    await this.redisService.delete(
      this.redisService.redisKeys({ sessionId, userId }),
    );
  }

  signRefreshToken(payload: JwtPayload) {
    return this.jwtService.sign(payload, {
      secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: '7d',
    });
  }

  signAccessToken(payload: JwtPayload) {
    return this.jwtService.sign(payload, {
      secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: '15m',
    });
  }
}
