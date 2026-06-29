import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { RedisService } from 'src/modules/redis/redis.service';
import { JwtPayload } from '../type/jwt-payload.type';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly redis: RedisService,
    configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      ignoreExpiration: false,
    });
  }

  async validate(payload: JwtPayload) {
    const redisKey = this.redis.redisKeys({
      userId: payload.sub,
      sessionId: payload.sessionId,
    });

    const exists = await this.redis.get(redisKey);

    if (!exists) {
      throw new UnauthorizedException('Session expired or invalid');
    }

    return {
      sub: payload.sub,
      email: payload.email,
      sessionId: payload.sessionId,
    };
  }
}
