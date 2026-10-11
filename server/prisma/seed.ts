import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const CATALOG = [
  { name: 'Удостоверение по охране труда', validityMonths: 36, sortOrder: 1 },
  { name: 'Удостоверение по электробезопасности', validityMonths: 12, sortOrder: 2 },
  { name: 'Удостоверение по пожарной безопасности', validityMonths: 36, sortOrder: 3 },
  { name: 'Медицинское заключение', validityMonths: 12, sortOrder: 4 },
];

async function main() {
  const login = process.env.SEED_ADMIN_LOGIN ?? 'admin';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'admin12345';

  const existing = await prisma.user.findUnique({ where: { login } });
  if (!existing) {
    await prisma.user.create({
      data: {
        fullName: 'Администратор',
        login,
        passwordHash: await bcrypt.hash(password, 10),
        role: 'ADMIN',
        // Временный пароль из .env — сменить при первом входе
        mustChangePassword: true,
      },
    });
    console.log(`Создан администратор: ${login}`);
  }

  if ((await prisma.credential.count()) === 0) {
    await prisma.credential.createMany({ data: CATALOG });
    console.log(`Справочник заполнен: ${CATALOG.length} позиции`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
