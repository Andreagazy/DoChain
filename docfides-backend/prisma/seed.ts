import 'dotenv/config';
import { hash } from 'bcrypt';
import { Pool } from 'pg';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL as string;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const seededUsers = [
  {
    email: 'superadmin@docchain.local',
    password: 'Superadmin123!',
    role: 'SUPERADMIN',
    displayName: 'Superadmin DOCChain',
  },
  {
    email: 'kajur@docchain.local',
    password: 'Jurusan123!',
    role: 'JURUSAN',
    displayName: 'Ketua Jurusan',
  },
  {
    email: 'kaprodi@docchain.local',
    password: 'Prodi123!',
    role: 'PRODI',
    displayName: 'Ketua Program Studi Informatika',
  },
  {
    email: 'kaprodi-si@docchain.local',
    password: 'ProdiSi123!',
    role: 'PRODI',
    displayName: 'Ketua Program Studi Sistem Informasi',
  },
  {
    email: 'admin-prodi-a@docchain.local',
    password: 'AdminProdiA123!',
    role: 'ADMIN_PRODI',
    displayName: 'Admin Prodi A',
  },
  {
    email: 'admin-prodi-b@docchain.local',
    password: 'AdminProdiB123!',
    role: 'ADMIN_PRODI',
    displayName: 'Admin Prodi B',
  },
  {
    email: 'dosen@docchain.local',
    password: 'Dosen123!',
    role: 'DOSEN',
    displayName: 'Dosen',
  },
  {
    email: 'mahasiswa@docchain.local',
    password: 'Mahasiswa123!',
    role: 'MAHASISWA',
    displayName: 'Mahasiswa',
  },
] as const;

async function main() {
  const results: Array<{ email: string; role: string; password: string }> = [];
  const jurusan = await prisma.academicUnit.upsert({
    where: { code: 'JTI' },
    update: {
      name: 'Jurusan Teknologi Informasi',
      type: 'JURUSAN',
      parentId: null,
      isActive: true,
    },
    create: {
      code: 'JTI',
      name: 'Jurusan Teknologi Informasi',
      type: 'JURUSAN',
      isActive: true,
    },
  });

  const prodiA = await prisma.academicUnit.upsert({
    where: { code: 'JTI-IF' },
    update: {
      name: 'Program Studi Informatika',
      type: 'PRODI',
      parentId: jurusan.id,
      isActive: true,
    },
    create: {
      code: 'JTI-IF',
      name: 'Program Studi Informatika',
      type: 'PRODI',
      parentId: jurusan.id,
      isActive: true,
    },
  });

  const prodiB = await prisma.academicUnit.upsert({
    where: { code: 'JTI-SI' },
    update: {
      name: 'Program Studi Sistem Informasi',
      type: 'PRODI',
      parentId: jurusan.id,
      isActive: true,
    },
    create: {
      code: 'JTI-SI',
      name: 'Program Studi Sistem Informasi',
      type: 'PRODI',
      parentId: jurusan.id,
      isActive: true,
    },
  });

  const savedByEmail = new Map<string, { id: string; email: string; role: string }>();

  const legacyPegawai = await prisma.user.findUnique({
    where: { email: 'pegawai@docchain.local' },
    select: { id: true },
  });
  const existingDosen = await prisma.user.findUnique({
    where: { email: 'dosen@docchain.local' },
    select: { id: true },
  });

  if (legacyPegawai && !existingDosen) {
    await prisma.user.update({
      where: { email: 'pegawai@docchain.local' },
      data: {
        email: 'dosen@docchain.local',
        role: 'DOSEN',
        displayName: 'Dosen',
      },
    });
  }

  for (const user of seededUsers) {
    const passwordHash = await hash(user.password, 10);
    const saved = await prisma.user.upsert({
      where: { email: user.email },
      update: {
        role: user.role,
        displayName: user.displayName,
        status: 'ACTIVE',
        emailVerifiedAt: new Date(),
        passwordHash,
      },
      create: {
        email: user.email,
        role: user.role,
        displayName: user.displayName,
        status: 'ACTIVE',
        emailVerifiedAt: new Date(),
        passwordHash,
      },
    });

    results.push({
      email: saved.email,
      role: saved.role,
      password: user.password,
    });
    savedByEmail.set(saved.email, saved);
  }

  const superadmin = savedByEmail.get('superadmin@docchain.local');
  const kajur = savedByEmail.get('kajur@docchain.local');
  const kaprodi = savedByEmail.get('kaprodi@docchain.local');
  const kaprodiSi = savedByEmail.get('kaprodi-si@docchain.local');
  const adminProdiA = savedByEmail.get('admin-prodi-a@docchain.local');
  const adminProdiB = savedByEmail.get('admin-prodi-b@docchain.local');
  const dosen = savedByEmail.get('dosen@docchain.local');
  const mahasiswa = savedByEmail.get('mahasiswa@docchain.local');

  for (const item of [
    {
      user: kajur,
      nip: '197001011995031001',
      nidn: '0001017001',
      employeeType: 'DOSEN',
      homeUnitId: jurusan.id,
      positionTitle: 'Ketua Jurusan',
      assignmentUnitId: jurusan.id,
      assignmentPosition: 'KAJUR',
    },
    {
      user: kaprodi,
      nip: '198001012005031001',
      nidn: '0001018001',
      employeeType: 'DOSEN',
      homeUnitId: prodiA.id,
      positionTitle: 'Ketua Program Studi Informatika',
      assignmentUnitId: prodiA.id,
      assignmentPosition: 'KAPRODI',
    },
    {
      user: kaprodiSi,
      nip: '198201012006031001',
      nidn: '0001018201',
      employeeType: 'DOSEN',
      homeUnitId: prodiB.id,
      positionTitle: 'Ketua Program Studi Sistem Informasi',
      assignmentUnitId: prodiB.id,
      assignmentPosition: 'KAPRODI',
    },
    {
      user: adminProdiA,
      nip: '199001012015031001',
      nidn: null,
      employeeType: 'ADMINISTRASI',
      homeUnitId: prodiA.id,
      positionTitle: 'Admin Prodi A',
      assignmentUnitId: prodiA.id,
      assignmentPosition: 'ADMIN_PRODI',
    },
    {
      user: adminProdiB,
      nip: '199101012015032001',
      nidn: null,
      employeeType: 'ADMINISTRASI',
      homeUnitId: prodiB.id,
      positionTitle: 'Admin Prodi B',
      assignmentUnitId: prodiB.id,
      assignmentPosition: 'ADMIN_PRODI',
    },
    {
      user: dosen,
      nip: '198501012010031001',
      nidn: '0001018501',
      employeeType: 'DOSEN',
      homeUnitId: prodiA.id,
      positionTitle: 'Dosen',
      assignmentUnitId: null,
      assignmentPosition: null,
    },
  ] as const) {
    if (!item.user) {
      continue;
    }

    await prisma.employeeProfile.upsert({
      where: { userId: item.user.id },
      update: {
        nip: item.nip,
        nidn: item.nidn,
        employeeType: item.employeeType,
        homeUnitId: item.homeUnitId,
        positionTitle: item.positionTitle,
      },
      create: {
        userId: item.user.id,
        nip: item.nip,
        nidn: item.nidn,
        employeeType: item.employeeType,
        homeUnitId: item.homeUnitId,
        positionTitle: item.positionTitle,
      },
    });

    if (item.assignmentUnitId && item.assignmentPosition) {
      await prisma.structuralAssignment.upsert({
        where: {
          userId_academicUnitId_position: {
            userId: item.user.id,
            academicUnitId: item.assignmentUnitId,
            position: item.assignmentPosition,
          },
        },
        update: {
          isActive: true,
          endsAt: null,
        },
        create: {
          userId: item.user.id,
          academicUnitId: item.assignmentUnitId,
          position: item.assignmentPosition,
          isActive: true,
        },
      });
    }
  }

  if (mahasiswa) {
    await prisma.studentProfile.upsert({
      where: { userId: mahasiswa.id },
      update: {
        nim: '2241720001',
        prodiId: prodiA.id,
        angkatan: 2022,
        kelas: 'TI-4A',
      },
      create: {
        userId: mahasiswa.id,
        nim: '2241720001',
        prodiId: prodiA.id,
        angkatan: 2022,
        kelas: 'TI-4A',
      },
    });
  }

  for (const identitySeed of [
    {
      user: adminProdiA,
      nik: '3504021990010101',
      fullName: 'Admin Prodi A',
      birthPlace: 'Malang',
      birthDate: new Date('1990-01-01T00:00:00.000Z'),
      address: 'Kantor Program Studi Informatika',
    },
    {
      user: adminProdiB,
      nik: '3504021991010102',
      fullName: 'Admin Prodi B',
      birthPlace: 'Malang',
      birthDate: new Date('1991-01-01T00:00:00.000Z'),
      address: 'Kantor Program Studi Sistem Informasi',
    },
  ] as const) {
    if (!identitySeed.user) {
      continue;
    }

    await prisma.identity.upsert({
      where: { userId: identitySeed.user.id },
      update: {
        nik: identitySeed.nik,
        fullName: identitySeed.fullName,
        birthPlace: identitySeed.birthPlace,
        birthDate: identitySeed.birthDate,
        address: identitySeed.address,
        status: 'APPROVED',
        verifiedBy: superadmin?.id ?? null,
        verifiedAt: new Date(),
      },
      create: {
        userId: identitySeed.user.id,
        nik: identitySeed.nik,
        fullName: identitySeed.fullName,
        birthPlace: identitySeed.birthPlace,
        birthDate: identitySeed.birthDate,
        address: identitySeed.address,
        status: 'APPROVED',
        verifiedBy: superadmin?.id ?? null,
        verifiedAt: new Date(),
      },
    });
  }

  console.table(results);
  console.table([
    { code: jurusan.code, name: jurusan.name, type: jurusan.type },
    { code: prodiA.code, name: prodiA.name, type: prodiA.type },
    { code: prodiB.code, name: prodiB.name, type: prodiB.type },
  ]);
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
