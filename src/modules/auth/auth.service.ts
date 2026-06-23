import {
  HttpException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  LoginPasswordDto,
  RefreshTokenDto,
  RegisterBodyDto,
} from './dto/body.dto';
import { ErrorMessages } from 'src/constant/message.errors';
import { bcryptCompare, bcryptHash } from 'src/common/utils/bcrypt';
import { randomUUID } from 'crypto';
import { JwtPayload, RefreshJwtPayload } from './type/jwt-payload.type';
import { AuthSession, DeviceType } from 'generated/prisma';

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
      enforceSessionLimit: true,
    });

    return tokens;
  }

  async register({
    device,
    email,
    firstname,
    lastname,
    password,
  }: RegisterBodyDto) {
    const userExist = await this.prismaService.user.findUnique({
      where: { email },
    });

    if (userExist) {
      throw new HttpException(ErrorMessages.USER.ALREADY_EXISTS, 403);
    }

    const hashedPassword = await bcryptHash(password);

    const user = await this.prismaService.$transaction(async (tx) => {
      return tx.user.create({
        data: { email, hashedPassword, lastname, firstname },
      });
    });

    const sessionId = randomUUID();
    const tokens = await this.createSession({
      userId: user.id,
      sessionId,
      device,
      email: user.email,
      enforceSessionLimit: false,
    });

    return tokens;
  }

  async changePassword({
    oldPassword,
    newPassword,
    userInfo,
  }: {
    userInfo: JwtPayload;
    oldPassword: string;
    newPassword: string;
  }) {
    const user = await this.prismaService.user.findUnique({
      where: { id: userInfo.sub, email: userInfo.email },
    });

    if (!user) {
      throw new HttpException(ErrorMessages.USER.NOT_FOUND, 404);
    }

    const comparePassword = await bcryptCompare(
      oldPassword,
      user.hashedPassword,
    );

    if (!comparePassword) {
      throw new UnauthorizedException(ErrorMessages.AUTH.INCORRECT_PASSWORD);
    }

    const isSamePassword = await bcryptCompare(
      newPassword,
      user.hashedPassword,
    );

    if (isSamePassword) {
      throw new HttpException(
        ErrorMessages.AUTH.PASSWORD_MUST_BE_DIFFERENT,
        400,
      );
    }

    const hashedPassword = await bcryptHash(newPassword);

    let sessionsToRemoveFromRedis: string[] = [];

    await this.prismaService.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { hashedPassword },
      });
      const sessions = await tx.authSession.findMany({
        where: { userId: user.id },
      });
      await tx.authSession.deleteMany({ where: { userId: user.id } });
      sessionsToRemoveFromRedis = sessions.map((session) => session.id);
    });

    await Promise.all(
      sessionsToRemoveFromRedis.map((oldSessionId) =>
        this.redisService.delete(
          this.redisService.redisKeys({
            userId: user.id,
            sessionId: oldSessionId,
          }),
        ),
      ),
    );
    return 'ok';
  }

  async refresh({
    device,
    email,
    sessionId,
    refreshToken,
    sub,
  }: RefreshTokenDto & RefreshJwtPayload) {
    const user = await this.prismaService.user.findUnique({
      where: { id: sub, email },
    });

    if (!user) {
      throw new HttpException(ErrorMessages.USER.NOT_FOUND, 404);
    }

    await this.removeSession({ userId: sub, sessionId });

    const newSessionId = randomUUID();
    const tokens = await this.createSession({
      device,
      email,
      sessionId: newSessionId,
      userId: sub,
      enforceSessionLimit: true,
    });

    return tokens;
  }

  async logout({ email, sessionId, sub }: JwtPayload) {
    const user = await this.prismaService.user.findUnique({
      where: { id: sub, email },
    });

    if (!user) {
      throw new HttpException(ErrorMessages.USER.NOT_FOUND, 404);
    }

    await this.removeSession({ sessionId, userId: sub });
    return 'ok';
  }

  async logoutAll({ email, sessionId, sub }: JwtPayload) {
    const user = await this.prismaService.user.findUnique({
      where: { id: sub, email },
    });

    if (!user) {
      throw new HttpException(ErrorMessages.USER.NOT_FOUND, 404);
    }

    const sessions = await this.prismaService.authSession.findMany({
      where: { userId: sub },
    });

    const sessionIds = sessions.map((session) => session.id);

    await Promise.all(
      sessionIds.map((sessionId) =>
        this.removeSession({ userId: sub, sessionId }),
      ),
    );

    return 'ok';
  }

  //////////////////
  /// SUB SERVICES
  //////////////////

  async createSession({
    userId,
    sessionId,
    device,
    email,
    enforceSessionLimit,
  }: {
    userId: number;
    sessionId: string;
    device: DeviceType;
    email: string;
    enforceSessionLimit?: boolean;
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
        if (enforceSessionLimit) {
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
        }
        const time = new Date();
        await tx.user.update({
          where: { id: userId },
          data: { lastLoginAt: time },
        });

        time.setDate(time.getDate() + 7);
        await tx.authSession.create({
          data: {
            id: sessionId,
            userId,
            expiresAt: time,
            deviceType: device,
            refreshHash: hashedRefreshToken,
          },
        });

        return { refreshToken, accessToken };
      },
      // For PostgreSQL, consider using:
      // { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    if (enforceSessionLimit) {
      await Promise.all(
        sessionsToRemoveFromRedis.map((oldSessionId) =>
          this.redisService.delete(
            this.redisService.redisKeys({ userId, sessionId: oldSessionId }),
          ),
        ),
      );
    }

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
