import { prisma } from "../src/index";

async function main() {
  const names = ["Aria", "Theo", "Iris", "Kai", "Mira", "Jules"];
  for (const displayName of names) {
    await prisma.user.upsert({
      where: { email: `${displayName.toLowerCase()}@seed.groupspeak.dev` },
      update: {},
      create: {
        email: `${displayName.toLowerCase()}@seed.groupspeak.dev`,
        displayName,
        isAnonymous: false,
        vibeScore: 70 + Math.random() * 20,
      },
    });
  }
  console.log(`Seeded ${names.length} users.`);
}

main().finally(async () => {
  await prisma.$disconnect();
});
