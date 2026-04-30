export function AnimatedMesh() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <div className="absolute inset-0 bg-background" />
      <div
        className="absolute -top-1/4 -left-1/4 h-[70vh] w-[70vh] rounded-full bg-signal-info/15 blur-3xl motion-safe:animate-mesh-drift"
        style={{ animationDelay: "-2s" }}
      />
      <div
        className="absolute bottom-[-20%] right-[-10%] h-[60vh] w-[60vh] rounded-full bg-signal-ok/10 blur-3xl motion-safe:animate-mesh-drift"
        style={{ animationDelay: "-12s", animationDuration: "32s" }}
      />
      <div
        className="absolute top-1/3 left-1/3 h-[45vh] w-[45vh] rounded-full bg-primary/10 blur-3xl motion-safe:animate-mesh-drift"
        style={{ animationDelay: "-6s", animationDuration: "40s" }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,hsl(var(--background))_85%)]" />
      <div
        className="absolute inset-0 opacity-[0.025] mix-blend-overlay"
        style={{
          backgroundImage:
            "radial-gradient(hsl(var(--foreground)) 0.5px, transparent 0.5px)",
          backgroundSize: "3px 3px",
        }}
      />
    </div>
  );
}
