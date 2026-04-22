import 'dotenv/config';
import { hash } from 'bcrypt';
import { Pool } from 'pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL as string;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const adminPasswordHash = await hash('Admin123!', 10);
  const verifierPasswordHash = await hash('Verifier123!', 10);
  const memberPasswordHash = await hash('Member123!', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@dochain.local' },
    update: {
      role: 'ADMIN',
      displayName: 'System Admin',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
      passwordHash: adminPasswordHash,
    },
    create: {
      email: 'admin@dochain.local',
      role: 'ADMIN',
      displayName: 'System Admin',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
      passwordHash: adminPasswordHash,
    },
  });

  const verifier = await prisma.user.upsert({
    where: { email: 'verifier@docfides.local' },
    update: {
      role: 'VERIFIER',
      displayName: 'Identity Verifier',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
      passwordHash: verifierPasswordHash,
    },
    create: {
      email: 'verifier@docfides.local',
      role: 'VERIFIER',
      displayName: 'Identity Verifier',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
      passwordHash: verifierPasswordHash,
    },
  });

  const member = await prisma.user.upsert({
    where: { email: 'member@dochain.local' },
    update: {
      role: 'MEMBER',
      displayName: 'Sample Member',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
      passwordHash: memberPasswordHash,
    },
    create: {
      email: 'member@dochain.local',
      role: 'MEMBER',
      displayName: 'Sample Member',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
      passwordHash: memberPasswordHash,
    },
  });

  console.log({
    admin: admin.email,
    verifier: verifier.email,
    member: member.email,
  });
  console.log('Admin password: Admin123!');
  console.log('Verifier password: Verifier123!');
  console.log('Member password: Member123!');
}

main()
  .then(async () => {
    await prisma.$disconnect();
    await pool.end();
  })
  .catch(async (error) => {
    console.error('Seed gagal:', error);
    await prisma.$disconnect();
    await pool.end();
    process.exit(1);
  });
