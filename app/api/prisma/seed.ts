import { hashPassword } from '../src/core/password.ts';
import { prisma } from '../src/core/db.ts';
import { ensureEmployeeAndLegacyRole, initializeOrganizationCatalog } from '../src/modules/organization/organization.service.ts';

const CATALOG = [
  { name: 'Удостоверение по охране труда', validityMonths: 36, sortOrder: 1 },
  { name: 'Удостоверение по электробезопасности', validityMonths: 12, sortOrder: 2 },
  { name: 'Удостоверение по пожарной безопасности', validityMonths: 36, sortOrder: 3 },
  { name: 'Медицинское заключение', validityMonths: 12, sortOrder: 4 },
];

async function main() {
  await initializeOrganizationCatalog();
  const login = process.env.SEED_ADMIN_LOGIN ?? 'admin';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'admin12345';

  const existing = await prisma.user.findUnique({ where: { login } });
  if (!existing) {
    const user = await prisma.user.create({
      data: {
        fullName: 'Администратор',
        login,
        passwordHash: await hashPassword(password),
        role: 'ADMIN',
        // Временный пароль из .env — сменить при первом входе
        mustChangePassword: true,
      },
    });
    await prisma.$transaction((tx) => ensureEmployeeAndLegacyRole(tx, user));
    console.log(`Создан администратор: ${login}`);
  }

  for (const user of await prisma.user.findMany()) {
    await prisma.$transaction((tx) => ensureEmployeeAndLegacyRole(tx, user));
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
