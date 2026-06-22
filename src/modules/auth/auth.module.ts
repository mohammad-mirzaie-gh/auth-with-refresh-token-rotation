import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import PrismaModule from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    ConfigModule,
    JwtModule.register({}),
  ],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
