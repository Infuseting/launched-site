import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding data...");

  // Create Admin User
  const adminDiscordId = process.env.DISCORD_ADMIN_IDS?.split(",")[0]?.trim() || "404390227814121482";
  const user = await prisma.user.upsert({
    where: { discordId: adminDiscordId },
    update: {
      sessionLimit: 20,
      role: "ADMIN",
    },
    create: {
      id: "admin-user-id",
      discordId: adminDiscordId,
      username: "Admin",
      role: "ADMIN",
      sessionLimit: 20,
    },
  });

  console.log("Admin ready:", user.username, `(${user.discordId})`);
}

main()
  .catch((e) => {
    console.error("Error seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
