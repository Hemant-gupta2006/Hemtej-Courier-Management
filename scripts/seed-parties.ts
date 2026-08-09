import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const initialParties = [
  {
    officialInvoiceName: "Savya Fashion",
    aliases: ["Savya Fashion"],
    addressLine1: "305/2432, KHANDAN GULLY, MOTILAL NAGAR 2",
    addressLine2: "M G ROAD, NEAR GANESH MAIDAN",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "400062",
    contactNumber: "9930996522",
    gstNumber: "27ACFS7725I2Z9",
  },
  {
    officialInvoiceName: "ZENITH GARMENT",
    aliases: ["ZENITH GARMENT"],
    addressLine1: "Shop No 02, Option Commercial Center, Milan Subway Road",
    addressLine2: "Near Milan Subway Road",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "400054",
    contactNumber: "+91 9987741121",
    gstNumber: "27AAAFZ7671E1ZW",
  },
  {
    officialInvoiceName: "Sadguru Enterprises",
    aliases: ["Sadguru Enterprises"],
    addressLine1: "Motilal Nagar No 03",
    addressLine2: "Goregaon West",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "400104",
    contactNumber: "8779563759",
    gstNumber: "27AIXPV9055I2B",
  },
  {
    officialInvoiceName: "Rameshwar Creation",
    aliases: ["Rameshwar Creation"],
    addressLine1: "Gala No 411, 4th Floor",
    addressLine2: "Shiv Solitare Garment Hub, Caves Road, Near Jogeshwari Station",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "400060",
    contactNumber: "9137214774",
    gstNumber: "27DDWPG6895R1Z0",
  },
  {
    officialInvoiceName: "Prem Creation",
    aliases: ["Prem Creation"],
    addressLine1: "115 Desh Udyog Mandir Ind. Estate First Floor",
    addressLine2: "Behind Bank Of Baroda, Caves Road",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "400060",
    contactNumber: "9768886312",
    gstNumber: "27AZZPG7652E1ZT",
  },
  {
    officialInvoiceName: "OCEAN BOUTIQUE",
    aliases: ["OCEAN BOUTIQUE"],
    addressLine1: "GAL NO 13, INTERLINK INDUSTRIAL ESTATE, Caves Road",
    addressLine2: "Jogeshwari East",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "400060",
    contactNumber: null,
    gstNumber: "27AAHFO2265J1Z1",
  },
  {
    officialInvoiceName: "Sulit",
    aliases: ["Sulit"],
    addressLine1: "Ground Floor Shop No 97/739 Motilal Nagar No 1",
    addressLine2: "Harubhau Rupwate MARG, Opp Police Chowky",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "400104",
    contactNumber: "+91 9870336136",
    gstNumber: "27ALKPG8361K1ZN",
  },
  {
    officialInvoiceName: "GATI APPARELS",
    aliases: ["GATI APPARELS"],
    addressLine1: "75/589 1st Floor, L C Scheme Govt, H Col",
    addressLine2: "Motilal Nagar, 3, M G Road, Near Azad Maidan",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "400104",
    contactNumber: "9773018560",
    gstNumber: "27AYPN4581D1ZP",
  },
  {
    officialInvoiceName: "Brahmani Creation",
    aliases: ["Brahmani Creation"],
    addressLine1: "Unit No 4, Desh Udyog Co Op Soc",
    addressLine2: "Behind High Tec Industrial, Bank Of Baroda, Caves Road",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "400060",
    contactNumber: "9930511259",
    gstNumber: "27AQHPB1578R1ZA",
  },
  {
    officialInvoiceName: "Aarushi Arts",
    aliases: ["Aarushi Arts"],
    addressLine1: "58/453 Anmol Society, Motilal Nagar 03",
    addressLine2: "M G Road, Next To Azad Maidan",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "400104",
    contactNumber: "+91 8169245547",
    gstNumber: "27AFHPN6112L1Z9",
  }
];

async function main() {
  const users = await prisma.user.findMany();
  
  if (users.length === 0) {
    console.log("No users found. Please create a user first.");
    return;
  }
  
  for (const user of users) {
    const userId = user.id;
    for (const party of initialParties) {
      await prisma.billingParty.upsert({
        where: {
          userId_officialInvoiceName: {
            userId,
            officialInvoiceName: party.officialInvoiceName,
          }
        },
        update: {
          addressLine1: party.addressLine1,
          addressLine2: party.addressLine2,
          city: party.city,
          state: party.state,
          pincode: party.pincode,
          contactNumber: party.contactNumber,
          gstNumber: party.gstNumber,
        },
        create: {
          ...party,
          userId,
        }
      });
    }
  }

  console.log(`Seeded/Updated parties for ${users.length} users.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
