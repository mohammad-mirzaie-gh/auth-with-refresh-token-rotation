import { Test, TestingModule } from '@nestjs/testing';
import PrismaModule from './prisma.module';
import { PrismaService } from './prisma.service';
import { PrismaClient } from '../../../generated/prisma/client';

describe('PrismaModule', () => {
  let module: TestingModule;

  afterEach(async () => {
    jest.restoreAllMocks();
    if (module) {
      await module.close();
    }
  });

  it('should provide PrismaService', async () => {
    module = await Test.createTestingModule({
      imports: [PrismaModule],
    }).compile();

    const prismaService = module.get<PrismaService>(PrismaService);

    expect(prismaService).toBeDefined();
    expect(prismaService).toBeDefined();
    expect(prismaService).toHaveProperty('$connect');
    expect(prismaService).toHaveProperty('$disconnect');
  });

  it('should call $connect on module.init()', async () => {
    const connectSpy = jest
      .spyOn(PrismaClient.prototype, '$connect')
      .mockResolvedValue(undefined);

    module = await Test.createTestingModule({
      imports: [PrismaModule],
    }).compile();

    module.get<PrismaService>(PrismaService);
    await module.init();

    expect(connectSpy).toHaveBeenCalledTimes(1);
  });

  it('should call $disconnect on module.close()', async () => {
    const disconnectSpy = jest
      .spyOn(PrismaClient.prototype, '$disconnect')
      .mockResolvedValue(undefined);

    module = await Test.createTestingModule({
      imports: [PrismaModule],
    }).compile();

    module.get<PrismaService>(PrismaService);
    await module.close();

    expect(disconnectSpy).toHaveBeenCalledTimes(1);
  });
});
