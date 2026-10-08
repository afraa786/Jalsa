import { Dashboard } from "@/components/dashboard";
import { Hero } from "@/components/hero";
import { MarketMap } from "@/components/market-map";
import { ProjectOverview } from "@/components/project-overview";

export default function Home() {
  return (
    <main>
      <Hero />
      <ProjectOverview />
      <MarketMap />
      <Dashboard />
    </main>
  );
}
