import { Dashboard } from "@/components/dashboard";
import { Hero } from "@/components/hero";

export default function Home() {
  return (
    <main className="flex__col">
      <Hero />
      <Dashboard />
    </main>
  );
}
