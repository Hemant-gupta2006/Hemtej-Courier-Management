import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const groupCount = await prisma.billingAliasGroup.count();
  const aliasCount = await prisma.billingAlias.count();
  console.log(`Groups: ${groupCount}, Aliases: ${aliasCount}`);
  
  if (groupCount > 0) {
    const groups = await prisma.billingAliasGroup.findMany({ include: { aliases: true }});
    console.log(JSON.stringify(groups, null, 2));
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
