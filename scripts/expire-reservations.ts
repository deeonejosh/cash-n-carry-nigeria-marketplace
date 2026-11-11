import { prisma } from '@/lib/prisma';
import { expireReservations, expireAuctionReservations } from '@/lib/reservations';

async function main() {
  try {
    console.log(`Expired order reservations: ${await expireReservations()}`);
    await prisma.authRateBucket.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    console.log(`Expired auction reservations: ${await expireAuctionReservations()}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
