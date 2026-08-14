import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const theme = await prisma.theme.upsert({
    where: { slug: 'pyar-bhare-geet' },
    update: {
      dayDesktop: '/assets/DesktopDay.png',
      dayMobile: '/assets/MobileDay.png',
      nightDesktop: '/assets/DesktopNight.png',
      nightMobile: '/assets/MobileNight.png'
    },
    create: {
      title: 'प्यार भरे गीत',
      subtitle: 'Lo-fi love · all night',
      slug: 'pyar-bhare-geet',
      playlistId: 'PLRiJDPquklv4cT2O5-gD4_C0-8a_R4NfO',
      dayDesktop: '/assets/DesktopDay.png',
      dayMobile: '/assets/MobileDay.png',
      nightDesktop: '/assets/DesktopNight.png',
      nightMobile: '/assets/MobileNight.png'
    }
  });
  console.log('Seed successful:', theme.title);
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
