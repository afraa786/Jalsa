"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { getFestivals, getForecast, getHeatmap, getPrediction, getZones } from "@/lib/api";
import type { CrowdLevel, Festival, Heatmap, HourForecast, Prediction } from "@/types/jalsa";

const LEVELS: CrowdLevel[] = ["Low", "Moderate", "High", "Very High"];
const LEVEL_COLORS: Record<CrowdLevel, string> = {
  Low: "#69212c",
  Moderate: "#8c2432",
  High: "#b32d3d",
  "Very High": "#d74755",
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short" }).format(
    new Date(`${value}T12:00:00`),
  );

function LevelPill({ level }: { level: CrowdLevel }) {
  return (
    <span className="level-pill" style={{ "--level-color": LEVEL_COLORS[level] } as CSSProperties}>
      <i /> {level}
    </span>
  );
}

function ForecastChart({ data, selectedDate }: { data: HourForecast[]; selectedDate: string }) {
  const max = Math.max(...data.map((item) => item.expected_crowd), 1);
  return (
    <div className="chart" aria-label="Expected crowd intensity by hour">
      {data.map((item) => (
        <div className="bar-column" key={item.hour}>
          <div className="bar-track">
            <div
              className="bar"
              style={{ height: `${(item.expected_crowd / max) * 100}%`, background: LEVEL_COLORS[item.level] }}
              title={`${item.hour}:00 — ${item.expected_crowd}%`}
            />
          </div>
          <span>{item.hour}</span>
        </div>
      ))}
      <small>{formatDate(selectedDate)} · expected crowd index</small>
    </div>
  );
}

export function Dashboard() {
  const [zones, setZones] = useState<string[]>([]);
  const [places, setPlaces] = useState<Array<{ name: string; zone: string }>>([]);
  const [festival, setFestival] = useState<Festival | null>(null);
  const [zone, setZone] = useState("main_market");
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [hour, setHour] = useState(19);
  const [rain, setRain] = useState(false);
  const [forecast, setForecast] = useState<Awaited<ReturnType<typeof getForecast>> | null>(null);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [heatmap, setHeatmap] = useState<Heatmap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [zoneInfo, festivalData] = await Promise.all([getZones(), getFestivals()]);
        if (!active) return;
        setZones(zoneInfo.zones);
        setPlaces(zoneInfo.places);
        setFestival(festivalData[0] ?? null);
      } catch (requestError) {
        if (active) setError(requestError instanceof Error ? requestError.message : "Unable to load JALSA data");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [retryKey]);

  useEffect(() => {
    let active = true;
    setError(null);
    async function loadForecasts() {
      try {
        const [day, currentPrediction, currentHeatmap] = await Promise.all([
          getForecast(zone, selectedDate, rain),
          getPrediction(zone, selectedDate, hour, rain),
          getHeatmap(zone, selectedDate, 7, rain),
        ]);
        if (!active) return;
        setForecast(day);
        setPrediction(currentPrediction);
        setHeatmap(currentHeatmap);
      } catch (requestError) {
        if (active) setError(requestError instanceof Error ? requestError.message : "Unable to load forecasts");
      }
    }
    loadForecasts();
    return () => { active = false; };
  }, [zone, selectedDate, hour, rain, retryKey]);

  const currentHour = useMemo(
    () => forecast?.hourly.find((item) => item.hour === hour) ?? forecast?.hourly[0],
    [forecast, hour],
  );

  const peak = useMemo(() => forecast?.hourly.reduce((best, item) => item.expected_crowd > best.expected_crowd ? item : best, forecast?.hourly[0]), [forecast]);

  return (
    <div className="dashboard">
      <section className="controls" aria-label="Forecast controls">
        <label>Zone<select value={zone} onChange={(event) => setZone(event.target.value)}>{zones.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}</select></label>
        <label>Date<input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} /></label>
        <label>Hour<select value={hour} onChange={(event) => setHour(Number(event.target.value))}>{Array.from({ length: 17 }, (_, index) => index + 7).map((item) => <option key={item} value={item}>{item}:00</option>)}</select></label>
        <label className="toggle"><input type="checkbox" checked={rain} onChange={(event) => setRain(event.target.checked)} /><span>Rain conditions</span></label>
      </section>

      {error && (
        <div className="error" role="alert">
          <span>Could not load the forecast: {error}</span>
          <button type="button" onClick={() => setRetryKey((value) => value + 1)}>Try again</button>
        </div>
      )}
      {loading && <div className="loading" role="status">Connecting to the JALSA model…</div>}

      {!loading && forecast && prediction && (
        <>
          <section className="summary-grid" id="forecast">
            <article className="card primary-card">
              <div className="card-heading"><span>Predicted activity</span><LevelPill level={prediction.level} /></div>
              <strong className="big-value">{prediction.expected_crowd}<small>%</small></strong>
              <p>Expected crowd intensity at {hour}:00 on {formatDate(selectedDate)}.</p>
              <div className="confidence"><span style={{ width: `${prediction.confidence * 100}%` }} /><small>{Math.round(prediction.confidence * 100)}% model confidence</small></div>
            </article>
            <article className="card">
              <span className="card-label">Peak window</span>
              <strong>{peak?.hour ?? "—"}:00</strong>
              <p>{peak?.expected_crowd ?? 0}% expected crowd intensity</p>
              <div className="mini-bars">{forecast.hourly.slice(0, 6).map((item) => <i key={item.hour} style={{ height: `${item.expected_crowd}%`, background: LEVEL_COLORS[item.level] }} />)}</div>
            </article>
            <article className="card">
              <span className="card-label">Places in zone</span>
              <strong>{places.filter((place) => place.zone === zone).length}</strong>
              <p>{places.filter((place) => place.zone === zone).map((place) => place.name).join(", ")}</p>
            </article>
          </section>

          <section className="content-grid">
            <article className="card wide-card">
              <div className="card-heading"><div><span className="card-label">Daily forecast</span><h2>Hourly crowd rhythm</h2></div><span className="note">07:00–23:00</span></div>
              <ForecastChart data={forecast.hourly} selectedDate={selectedDate} />
            </article>
            <article className="card prediction-card">
              <span className="card-label">Model prediction</span>
              <h2>{prediction.level} crowd</h2>
              <div className="probability-list">{LEVELS.map((level) => <div key={level}><span>{level}</span><b>{Math.round(prediction.probabilities[level] * 100)}%</b><i><em style={{ width: `${prediction.probabilities[level] * 100}%`, background: LEVEL_COLORS[level] }} /></i></div>)}</div>
              <p className="uncertainty">Monte Carlo range: {Math.round(prediction.monte_carlo.p10)}–{Math.round(prediction.monte_carlo.p90)}% crowd index.</p>
            </article>
          </section>

          <section className="card heatmap-card" id="heatmap">
            <div className="card-heading"><div><span className="card-label">14-day outlook</span><h2>Area activity heatmap</h2></div><span className="note">{zone.replaceAll("_", " ")}</span></div>
            <div className="heatmap-scroll">
              <div className="heatmap-grid">
                <span className="corner">Date</span>
                {heatmap?.data[0]?.hours.map((hour) => <span key={hour} className="hour-label">{hour}</span>)}
                {heatmap?.data.map((day) => <div className="row" key={day.date}><span>{formatDate(day.date).split(" ")[0]}<small>{day.date.slice(8)}</small></span>{day.expected_crowd.map((value, index) => <i key={index} style={{ background: `rgba(175,38,54,${0.14 + value / 100 * 0.75})` }} title={`${value}%`} />)}</div>)}
              </div>
            </div>
          </section>
        </>
      )}

      <section className="about-image" aria-label="Why crowd awareness matters">
        <p>Knowing when an area is busy helps you plan when and where to go.</p>
      </section>

      <section className="methodology" id="methodology">
        <div><span className="eyebrow">About the signal</span><h2>Transparent by design.</h2></div>
        <div><p>JALSA does not claim to provide exact live pedestrian counts. It predicts a place-level crowd index using synthetic training data and model uncertainty estimates.</p><p>{festival ? `${festival.name} is configured as a ${festival.weight} event impact in the model.` : "No upcoming festival is currently configured."}</p></div>
      </section>

      <footer><strong>JALSA</strong><span>Crowd intelligence without pretending to be exact.</span><span>© {new Date().getFullYear()}</span></footer>
    </div>
  );
}
