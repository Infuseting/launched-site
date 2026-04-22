import { getLatestRelease } from "@/lib/github";
import Hero from "@/components/Hero";

export default async function Home() {
  const release = await getLatestRelease();

  return (
    <main className="flex min-h-screen flex-col">
      <Hero release={release} />
    </main>
  );
}
