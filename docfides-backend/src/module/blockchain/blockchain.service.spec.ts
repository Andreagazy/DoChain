import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BlockchainService } from './blockchain.service';

describe('BlockchainService', () => {
  it('should be defined', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        BlockchainService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn() },
        },
      ],
    }).compile();

    expect(moduleRef.get(BlockchainService)).toBeDefined();
  });
});
