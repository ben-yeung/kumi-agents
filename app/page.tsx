import { Closing } from "@/components/sections/Closing";
import { Hero } from "@/components/sections/Hero";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { ManyHands } from "@/components/sections/ManyHands";
import { Nav } from "@/components/sections/Nav";
import { WorkLog } from "@/components/sections/WorkLog";
import { Swarm } from "@/components/swarm/Swarm";
import { VisitorCursor } from "@/components/visitor/VisitorCursor";

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <ManyHands />
        <HowItWorks />
        <WorkLog />
        <Closing />
      </main>
      <Swarm />
      <VisitorCursor />
    </>
  );
}
