import { Test, TestingModule } from '@nestjs/testing';
import { RedisModule } from './redis.module';
import { RedisService } from './redis.service';

describe('RedisModule', () => {
  let module: TestingModule;

  const mockRedisService = {
    getClient: jest.fn(),
    set: jest.fn(),
    get: jest.fn(),
    delete: jest.fn(),
    onModuleDestroy: jest.fn(),
  };

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [RedisModule],
    })
      .overrideProvider(RedisService)
      .useValue(mockRedisService)
      .compile();
  });

  afterEach(async () => {
    await module.close();
    jest.clearAllMocks();
  });

  it('should compile the module', () => {
    expect(module).toBeDefined();
  });

  it('should provide RedisService', () => {
    const redisService = module.get<RedisService>(RedisService);

    expect(redisService).toBeDefined();
    expect(redisService).toBe(mockRedisService);
  });
});
