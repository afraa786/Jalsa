export function Hero() {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-copy">
        <p className="eyebrow">Crowd intelligence, made visible</p>
        <h1 id="hero-title">Know when the city gets busy.</h1>
        <p className="lede">
          Explore expected crowd intensity by place, hour, and day. JALSA combines
          transparent model forecasts with place-level observations.
        </p>
        <a className="hero-cta" href="#forecast">
          Explore the forecast <span aria-hidden="true">↓</span>
        </a>
      </div>

      <div className="hero-visual" aria-hidden="true">
        <div className="orbit orbit-one" />
        <div className="orbit orbit-two" />
        <div className="signal-card">
          <span>Live model signal</span>
          <strong>JALSA</strong>
          <div className="signal-bars">
            <i /><i /><i /><i /><i /><i />
          </div>
        </div>
      </div>
    </section>
  );
}
