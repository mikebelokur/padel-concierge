import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(circle at center, rgba(45, 125, 255, 0.1) 0%, transparent 60%)" }} />
      
      <div className="z-10 text-center max-w-3xl">
        <h1 className="text-5xl md:text-7xl font-serif mb-6 tracking-tight">Padel Concierge</h1>
        <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-xl mx-auto leading-relaxed">
          The private members club for serious padel players. Precise matchmaking, certified skill levels, and premium play analytics.
        </p>
        
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/register">
            <Button size="lg" className="w-full sm:w-auto font-medium text-lg px-8 py-6 h-auto">Get Started</Button>
          </Link>
          <Link href="/login">
            <Button variant="outline" size="lg" className="w-full sm:w-auto font-medium text-lg px-8 py-6 h-auto bg-transparent border-white/10 hover:bg-white/5">Login</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
