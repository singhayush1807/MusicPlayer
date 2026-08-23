import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    const theme = await prisma.theme.create({
      data: {
        title: "Test Theme",
        subtitle: "A test theme",
        slug: "test-theme-" + Date.now(),
        playlistId: "PLRiJDPquklv4",
        customSequence: null,
        dayDesktop: "https://example.com/dayD.png",
        dayMobile: "https://example.com/dayM.png",
        nightDesktop: "https://example.com/nightD.png",
        nightMobile: "https://example.com/nightM.png",
      }
    });
    console.log("Theme created:", theme);
  } catch (error) {
    console.error("Prisma error:");
    console.dir(error, { depth: null });
  } finally {
    await prisma.$disconnect();
  }
}

main();
