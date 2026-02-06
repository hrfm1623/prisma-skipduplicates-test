import { createPrisma } from "./prisma-client";
import { resetAndSeedScenarioData } from "./scenario";

async function main() {
  const prisma = createPrisma();

  try {
    await resetAndSeedScenarioData(prisma);

    console.log("Seed completed.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
