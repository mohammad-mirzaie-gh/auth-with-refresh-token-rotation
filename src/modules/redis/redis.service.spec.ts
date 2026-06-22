import { InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { RedisService } from './redis.service';
import { ErrorMessages } from '../../constant/message.errors';

jest.mock('ioredis');

describe('RedisService', () => {
  let service: RedisService;
  let configService: jest.Mocked<ConfigService>;

  const redisMock = {
    on: jest.fn(),
    set: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
    quit: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    (Redis as unknown as jest.Mock).mockImplementation(() => redisMock);

    configService = {
      get: jest.fn((key: string, defaultValue?: unknown) => {
        const config = {
          REDIS_HOST: 'localhost',
          REDIS_PORT: 6379,
        };

        return config[key] ?? defaultValue;
      }),
    } as unknown as jest.Mocked<ConfigService>;

    service = new RedisService(configService);
  });

  describe('constructor', () => {
    it('should create redis client with config values', () => {
      expect(Redis).toHaveBeenCalledWith({
        host: 'localhost',
        port: 6379,
        lazyConnect: true,
        retryStrategy: expect.any(Function),
        maxRetriesPerRequest: 3,
      });
    });

    it('should register redis event listeners', () => {
      expect(redisMock.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(redisMock.on).toHaveBeenCalledWith('ready', expect.any(Function));
      expect(redisMock.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(redisMock.on).toHaveBeenCalledWith('close', expect.any(Function));
    });

    it('should use fallback values when config is missing', () => {
      jest.clearAllMocks();

      configService.get.mockImplementation(
        (_key: string, defaultValue?: unknown) => defaultValue,
      );

      service = new RedisService(configService);

      expect(Redis).toHaveBeenCalledWith({
        host: '127.0.0.1',
        port: 6379,
        lazyConnect: true,
        retryStrategy: expect.any(Function),
        maxRetriesPerRequest: 3,
      });
    });

    it('should return retry delay with max 2000ms', () => {
      const redisOptions = (Redis as unknown as jest.Mock).mock.calls[0][0];

      expect(redisOptions.retryStrategy(1)).toBe(50);
      expect(redisOptions.retryStrategy(10)).toBe(500);
      expect(redisOptions.retryStrategy(100)).toBe(2000);
    });
  });

  describe('set', () => {
    it('should set value without ttl', async () => {
      redisMock.set.mockResolvedValue('OK');

      await service.set('key', 'value');

      expect(redisMock.set).toHaveBeenCalledWith('key', 'value');
    });

    it('should set value with ttl', async () => {
      redisMock.set.mockResolvedValue('OK');

      await service.set('key', 'value', 60);

      expect(redisMock.set).toHaveBeenCalledWith('key', 'value', 'EX', 60);
    });

    it('should throw InternalServerErrorException when set fails', async () => {
      redisMock.set.mockRejectedValue(new Error('Redis set failed'));

      await expect(service.set('key', 'value')).rejects.toThrow(
        InternalServerErrorException,
      );

      await expect(service.set('key', 'value')).rejects.toThrow(
        ErrorMessages.REDIS.REDIS_SET_FAILED,
      );
    });
  });

  describe('get', () => {
    it('should return value by key', async () => {
      redisMock.get.mockResolvedValue('value');

      await expect(service.get('key')).resolves.toBe('value');

      expect(redisMock.get).toHaveBeenCalledWith('key');
    });

    it('should return null when key does not exist', async () => {
      redisMock.get.mockResolvedValue(null);

      await expect(service.get('key')).resolves.toBeNull();
    });

    it('should throw InternalServerErrorException when get fails', async () => {
      redisMock.get.mockRejectedValue(new Error('Redis get failed'));

      await expect(service.get('key')).rejects.toThrow(
        InternalServerErrorException,
      );

      await expect(service.get('key')).rejects.toThrow(
        ErrorMessages.REDIS.REDIS_GET_FAILED,
      );
    });
  });

  describe('delete', () => {
    it('should delete key', async () => {
      redisMock.del.mockResolvedValue(1);

      await service.delete('key');

      expect(redisMock.del).toHaveBeenCalledWith('key');
    });

    it('should throw InternalServerErrorException when delete fails', async () => {
      redisMock.del.mockRejectedValue(new Error('Redis delete failed'));

      await expect(service.delete('key')).rejects.toThrow(
        InternalServerErrorException,
      );

      await expect(service.delete('key')).rejects.toThrow(
        ErrorMessages.REDIS.REDIS_DELETE_FAILED,
      );
    });
  });

  describe('redisKeys', () => {
    it('should generate session redis key', () => {
      const key = service.redisKeys({
        userId: 12,
        sessionId: 'abc',
      });

      expect(key).toBe('session:12:abc');
    });
  });

  describe('getClient', () => {
    it('should return redis client instance', () => {
      expect(service.getClient()).toBe(redisMock);
    });
  });

  describe('onModuleDestroy', () => {
    it('should quit redis connection', async () => {
      redisMock.quit.mockResolvedValue('OK');

      await service.onModuleDestroy();

      expect(redisMock.quit).toHaveBeenCalled();
    });
  });
});
