import { Dashboard } from "@/components/dashboard";
import { Hero } from "@/components/hero";
import { ProjectOverview } from "@/components/project-overview";

export default function Home() {
  return (
    <main>
      <Hero />
      <ProjectOverview />
      <Dashboard />
    </main>
  );
}
