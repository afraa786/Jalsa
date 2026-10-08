import MetroHero from "@/components/ui/scroll-locked-video-hero";

export function Hero() {
  return (
    <div className="hero-stage">
      <nav className="cinema-menu" aria-label="Primary navigation">
        <a href="#top" className="cinema-brand">JALSA</a>
        <a href="#forecast" className="cinema-menu-link">Explore forecast <span aria-hidden="true">↓</span></a>
      </nav>
      <MetroHero
        videoSrc="https://v1.pinimg.com/videos/iht/expMp4/df/c1/71/dfc171d5cdb85c31c0cf712a430b7d7d_720w.mp4"
        loopPlayback
        scrollHint={false}
        title={<>JALSA - <em>KNOW your area</em></>}
        tagline="Crowd intelligence, made visible."
        signature={{ name: "View film source", url: "https://www.pinterest.com/pin/804807395952195353/" }}
      />
    </div>
  );
}
