import {
  Injectable,
  Logger,
  OnModuleDestroy,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { ErrorMessages } from '../../constant/message.errors';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis;
  private readonly logger = new Logger(RedisService.name);

  constructor(private readonly configService: ConfigService) {
    this.client = new Redis({
      host: this.configService.get<string>('REDIS_HOST', '127.0.0.1'),
      port: this.configService.get<number>('REDIS_PORT', 6379),
      lazyConnect: true,
      retryStrategy: (times) => Math.min(times * 50, 2000),
      maxRetriesPerRequest: 3,
    });

    this.client.on('connect', () => {
      this.logger.log('Redis connection established');
    });

    this.client.on('ready', () => {
      this.logger.log('Redis is ready to use');
    });

    this.client.on('error', (err) => {
      this.logger.error('Redis error', err);
    });

    this.client.on('close', () => {
      this.logger.warn('Redis connection closed');
    });
  }

  async set(
    key: string,
    value: string | number,
    ttlSeconds?: number,
  ): Promise<void> {
    try {
      if (ttlSeconds !== undefined) {
        await this.client.set(key, value, 'EX', ttlSeconds);
      } else {
        await this.client.set(key, value);
      }
    } catch (error) {
      throw new InternalServerErrorException(
        ErrorMessages.REDIS.REDIS_SET_FAILED,
      );
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(key);
    } catch (error) {
      throw new InternalServerErrorException(
        ErrorMessages.REDIS.REDIS_GET_FAILED,
      );
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (error) {
      this.logger.error(`Redis DEL error: ${key}`, error);
      throw new InternalServerErrorException(
        ErrorMessages.REDIS.REDIS_DELETE_FAILED,
      );
    }
  }

  redisKeys({ userId, sessionId }: { userId: number; sessionId: string }) {
    return `session:${userId}:${sessionId}`;
  }

  // ------------------------

  getClient(): Redis {

    return this.client;
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

}
