import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const entries = await prisma.courierEntry.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true, challanNo: true, date: true, createdAt: true, srNo: true },
    take: 20
  });
  console.log(JSON.stringify(entries, null, 2));

  const maxChallan = await prisma.courierEntry.findFirst({
    orderBy: { challanNo: 'desc' },
    select: { challanNo: true }
  });
  console.log("Max Challan:", maxChallan);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
