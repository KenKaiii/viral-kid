import { CardGrid } from "@/components/card-grid";
import { ShaderBackground } from "@/components/ui/shader-background";

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <ShaderBackground />
      <div className="relative z-10">
        <CardGrid />
      </div>
    </main>
  );
}
