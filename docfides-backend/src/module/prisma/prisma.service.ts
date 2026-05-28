import { Injectable } from '@nestjs/common';
import { createRequire } from 'module';
import { join } from 'path';
import { PrismaPg } from '@prisma/adapter-pg';
import type { PrismaClient as PrismaClientType } from '../../../generated/prisma/client';

const requireFromProjectRoot = createRequire(join(process.cwd(), 'package.json'));
const { PrismaClient } = requireFromProjectRoot(
  './generated/prisma/client',
) as typeof import('../../../generated/prisma/client');

@Injectable()
export class PrismaService extends PrismaClient implements PrismaClientType {
  constructor() {
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL as string,
    });
    super({ adapter });
  }
}
