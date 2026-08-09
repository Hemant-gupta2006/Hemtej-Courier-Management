import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const groups = await prisma.billingAliasGroup.findMany({ include: { aliases: true }});
  
  for (const group of groups) {
    const aliasNames = group.aliases.map(a => a.aliasName);
    
    // Create BillingParty
    await prisma.billingParty.upsert({
      where: {
        userId_officialInvoiceName: {
          userId: group.userId,
          officialInvoiceName: group.billingPartyName
        }
      },
      update: {
        aliases: aliasNames
      },
      create: {
        userId: group.userId,
        officialInvoiceName: group.billingPartyName,
        aliases: aliasNames,
        addressLine1: group.address,
        city: group.city,
        state: group.state,
        pincode: group.pincode,
        contactNumber: group.mobileNumber,
        gstNumber: group.gstNumber,
      }
    });
  }
  console.log(`Migrated ${groups.length} groups.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
