const GOOGLE_MAPS_LINK = "https://www.google.com/maps/place/Vaishali+Nagar+market/@19.1449354,72.8446094,17z/data=!3m1!4b1!4m6!3m5!1s0x3be7b7576fb1ae83:0xbbdffce986dc2976!8m2!3d19.1449354!4d72.8446094!16s%2Fg%2F11tj38y6m_?entry=ttu&g_ep=EgoyMDI2MTAwNS4wIKX";
const MAP_EMBED_URL = "https://www.google.com/maps?q=19.1449354,72.8446094&z=17&output=embed";

export function MarketMap() {
  return (
    <section className="market-map" aria-labelledby="market-map-title">
      <div className="market-map__heading">
        <div>
          <span className="card-label">Market location</span>
          <h2 id="market-map-title">Vaishali Nagar Market</h2>
          <p>19.1449354° N, 72.8446094° E</p>
        </div>
        <a href={GOOGLE_MAPS_LINK} target="_blank" rel="noreferrer">Open in Google Maps <span aria-hidden="true">↗</span></a>
      </div>
      <iframe
        src={MAP_EMBED_URL}
        title="Google Maps location for Vaishali Nagar Market"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        allowFullScreen
      />
    </section>
  );
}
