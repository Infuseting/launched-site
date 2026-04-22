import { getLatestRelease } from "@/lib/github";
import Hero from "@/components/Hero";
import Features from "@/components/Features";

export default async function Home() {
  const release = await getLatestRelease();

  return (
    <main className="flex min-h-screen flex-col bg-black">
      <Hero release={release} />
      <Features />
    </main>
  );
}
