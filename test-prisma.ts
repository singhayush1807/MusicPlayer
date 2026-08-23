import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://postgres:ayush8252043282tanya7004953482@db.wtqhaarkmdqashehvmdp.supabase.co:6543/postgres?pgbouncer=true"
    }
  }
});

async function main() {
  try {
    const theme = await prisma.theme.create({
      data: {
        title: "Test Local",
        subtitle: "A test theme",
        slug: "test-local-" + Date.now(),
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
