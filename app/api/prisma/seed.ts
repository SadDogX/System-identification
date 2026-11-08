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
  const adminPosition = await prisma.position.upsert({ where: { name: 'Administrator' }, update: {}, create: { name: 'Administrator', sortOrder: 0, systemRole: { connect: { code: 'ADMIN' } } } });
  const login = process.env.SEED_ADMIN_LOGIN ?? 'admin';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'admin123';

  let admin = await prisma.user.findUnique({ where: { login } });
  if (!admin) {
    await prisma.user.create({
      data: {
        fullName: 'Administrator',
        login,
        passwordHash: await hashPassword(password),
        positionId: adminPosition.id,
        mustChangePassword: true,
      },
    });
    console.log('Created administrator: ' + login);
  }
  admin = await prisma.user.findUniqueOrThrow({ where: { login } });
  if (admin.positionId !== adminPosition.id) {
    admin = await prisma.user.update({ where: { id: admin.id }, data: { positionId: adminPosition.id } });
    const employee = await prisma.employee.findUnique({ where: { userId: admin.id } });
    if (employee) await prisma.employeeAssignment.updateMany({ where: { employeeId: employee.id, activeEmployeeId: employee.id }, data: { positionId: adminPosition.id } });
  }
  await prisma.$transaction((tx) => ensureEmployeeAndLegacyRole(tx, admin!));
  for (const user of await prisma.user.findMany({ where: { id: { not: admin.id } } })) await prisma.$transaction((tx) => ensureEmployeeAndLegacyRole(tx, user));

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
