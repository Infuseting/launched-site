import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding test data...");

  // 1. Create User
  const user = await prisma.user.upsert({
    where: { discordId: "123456789" },
    update: {
      sessionLimit: 5,
      role: "ADMIN",
    },
    create: {
      id: "test-user-id",
      discordId: "123456789",
      username: "DevTester",
      role: "ADMIN",
      sessionLimit: 5,
      sftpPassword: "dummy-encrypted-password",
    },
  });

  console.log("User ready:", user.username);

  // 2. Create Session
  const session = await prisma.session.upsert({
    where: { slug: "survival-modde" },
    update: {
      isActive: true,
      name: "Survival Moddé",
      minecraft: "1.20.1",
      forge: null,
      fabric: "0.15.7",
      welcome: "Bienvenue sur Survival Moddé !",
      jvmArg: "-Xmx4G",
    },
    create: {
      id: "session-test-uuid",
      slug: "survival-modde",
      name: "Survival Moddé",
      minecraft: "1.20.1",
      fabric: "0.15.7",
      syncDir: "mods,resourcepacks,config",
      welcome: "Bienvenue sur Survival Moddé !",
      jvmArg: "-Xmx4G",
      credits: "Propulsé par Launched",
      hostname: "play.example.com",
      crack: true,
      isActive: true,
      members: {
        create: {
          userId: user.id,
          role: "OWNER",
        },
      },
      links: {
        create: [
          {
            name: "Discord",
            url: "https://discord.gg/minecraft",
            icon: "/assets/icons/discord.svg",
          },
          {
            name: "Site Web",
            url: "https://launched.infuseting.fr",
            icon: "/assets/icons/website.svg",
          },
        ],
      },
    },
  });

  console.log("Session ready:", session.name, `(${session.slug})`);
}

main()
  .catch((e) => {
    console.error("Error seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
