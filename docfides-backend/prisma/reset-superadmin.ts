import 'dotenv/config';
import { hash } from 'bcrypt';
import { Pool } from 'pg';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const email = process.env.RESET_SUPERADMIN_EMAIL ?? 'superadmin@docchain.local';
const password = process.env.RESET_SUPERADMIN_PASSWORD ?? 'Superadmin123!';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const passwordHash = await hash(password, 10);
    const user = await prisma.user.update({
      where: { email },
      data: {
        passwordHash,
        status: 'ACTIVE',
        emailVerifiedAt: new Date(),
      },
      select: {
        email: true,
        role: true,
        status: true,
      },
    });

    console.log(`Password ${user.role} ${user.email} berhasil direset.`);
    console.log(`Password baru: ${password}`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Reset superadmin gagal:', error);
  process.exit(1);
});
