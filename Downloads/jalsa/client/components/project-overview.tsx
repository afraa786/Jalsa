"use client";

import { useEffect, useState, type FormEvent } from "react";
import { getFestivals, getHealth, getMetrics, getZones, logReading, retrainModel } from "@/lib/api";
import type { Festival, ModelMetrics, ServiceHealth, ZoneInfo } from "@/types/jalsa";

const numberFormat = new Intl.NumberFormat("en-IN");

export function ProjectOverview() {
  const [zones, setZones] = useState<ZoneInfo | null>(null);
  const [festivals, setFestivals] = useState<Festival[]>([]);
  const [metrics, setMetrics] = useState<ModelMetrics | null>(null);
  const [health, setHealth] = useState<ServiceHealth | null>(null);
  const [place, setPlace] = useState("");
  const [livePct, setLivePct] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [retraining, setRetraining] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;

    Promise.allSettled([getZones(), getFestivals(), getMetrics(), getHealth()]).then((results) => {
      if (!active) return;
      const [zoneResult, festivalResult, metricsResult, healthResult] = results;
      if (zoneResult.status === "fulfilled") {
        setZones(zoneResult.value);
        setPlace(zoneResult.value.places[0]?.name ?? "");
      }
      if (festivalResult.status === "fulfilled") setFestivals(festivalResult.value);
      if (metricsResult.status === "fulfilled") setMetrics(metricsResult.value);
      if (healthResult.status === "fulfilled") setHealth(healthResult.value);
      if (results.every((result) => result.status === "rejected")) {
        setErrorMessage("Backend unavailable. Start the JALSA API to load live project data.");
      }
      setLoading(false);
    });

    return () => { active = false; };
  }, []);

  const selectedPlace = zones?.places.find((item) => item.name === place);

  async function submitReading(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedPlace) return;
    setSaving(true);
    setErrorMessage("");
    setStatusMessage("");
    try {
      const result = await logReading({
        place: selectedPlace.name,
        zone: selectedPlace.zone,
        live_pct: Number(livePct),
      });
      setStatusMessage(`Saved ${result.live_pct}% for ${result.place}.`);
      setLivePct("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not save this reading.");
    } finally {
      setSaving(false);
    }
  }

  async function startRetraining() {
    setRetraining(true);
    setErrorMessage("");
    setStatusMessage("");
    try {
      const result = await retrainModel();
      setStatusMessage(result.status === "retraining_started" ? "Model retraining started in the backend." : result.status);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not start retraining.");
    } finally {
      setRetraining(false);
    }
  }

  return (
    <section className="project-overview" id="project-overview" aria-labelledby="overview-title">
      <div className="overview-heading">
        <div>
          <span className="eyebrow">Inside JALSA</span>
          <h2 id="overview-title">The system, in brief.</h2>
        </div>
        <p>Live project configuration and persisted model metrics from the backend.</p>
      </div>

      {errorMessage && !zones && <p className="overview-alert" role="status">{errorMessage}</p>}

      <div className="overview-grid">
        <article className="overview-card coverage-card">
          <span className="card-label">01 / Coverage & events</span>
          <div className="overview-stats">
            <div><strong>{zones?.zones.length ?? "—"}</strong><span>zones</span></div>
            <div><strong>{zones?.places.length ?? "—"}</strong><span>monitored places</span></div>
            <div><strong>{zones?.levels.length ?? "—"}</strong><span>crowd bands</span></div>
          </div>
          <div className="overview-rule" />
          <div className="overview-split">
            <div>
              <h3>Monitored areas</h3>
              {zones?.zones.map((item) => <span className="overview-tag" key={item}>{item.replaceAll("_", " ")}</span>)}
            </div>
            <div>
              <h3>Upcoming festivals</h3>
              {festivals.length ? festivals.slice(0, 3).map((item) => (
                <p className="overview-event" key={`${item.date}-${item.name}`}><strong>{item.name}</strong><span>{item.date}</span></p>
              )) : <p className="overview-muted">{loading ? "Loading events…" : "No upcoming events configured."}</p>}
            </div>
          </div>
        </article>

        <article className="overview-card dataset-card">
          <span className="card-label">02 / Training data</span>
          <h3>Simulation first. Observations when available.</h3>
          <div className="dataset-counts">
            <div><span>Synthetic training rows</span><strong>{metrics ? numberFormat.format(metrics.synthetic_training_rows) : "—"}</strong></div>
            <div><span>Logged real readings</span><strong>{metrics ? numberFormat.format(metrics.real_data_rows) : "—"}</strong></div>
            <div><span>Real-data blend</span><strong>{metrics ? (metrics.real_data_blended ? `${metrics.real_data_weight}× weight` : "Not blended") : "—"}</strong></div>
          </div>
          <p className="overview-note">Synthetic scenarios vary by hour, weekday, zone, rain, and configured festival effects. Valid place readings are blended after the 150-reading threshold; live counts are not claimed.</p>
          <p className="overview-muted">Current data: {metrics?.real_data_rows ? "logged place-level busyness signals" : "no logged observations in the current training metrics"}.</p>
        </article>

        <article className="overview-card model-card">
          <span className="card-label">03 / Model & evaluation</span>
          <div className="model-heading">
            <div><h3>{metrics?.model ?? "XGBoost"}</h3><p>{metrics?.task ?? "4-class crowd intensity classification"}</p></div>
            <strong>{metrics ? `${Math.round(metrics.accuracy * 100)}%` : "—"}<small>accuracy</small></strong>
          </div>
          <div className="dataset-counts model-counts">
            <div><span>Evaluation rows</span><strong>{metrics ? numberFormat.format(metrics.test_rows) : "—"}</strong></div>
            <div><span>Input features</span><strong>{metrics?.features.length ?? "—"}</strong></div>
          </div>
          <div className="feature-list">{metrics?.features.slice(0, 7).map((feature) => <span className="overview-tag" key={feature}>{feature.replaceAll("_", " ")}</span>)}</div>
          <p className="overview-note">{metrics?.note ?? "Metrics load from the trained model's persisted evaluation report."}</p>
        </article>

        <article className="overview-card backend-card">
          <div className="backend-card-heading">
            <div><span className="card-label">04 / Backend tools</span><h3>Service & observations</h3></div>
            <span className={`service-badge ${health?.status === "ok" ? "is-online" : ""}`}><i />{health?.status === "ok" ? "Online" : loading ? "Checking" : "Offline"}</span>
          </div>
          <div className="endpoint-list" aria-label="Available backend features">
            <span>Prediction</span><span>Day forecast</span><span>Heatmap</span><span>Festivals</span><span>Metrics</span><span>CSV logging</span>
          </div>
          <form className="reading-form" onSubmit={submitReading}>
            <label>Place<select value={place} onChange={(event) => setPlace(event.target.value)} required disabled={!zones?.places.length}>
              {zones?.places.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
            </select></label>
            <label>Busyness %<input type="number" min="0" max="100" step="0.1" value={livePct} onChange={(event) => setLivePct(event.target.value)} placeholder="0–100" required /></label>
            <button type="submit" disabled={saving || !selectedPlace}>{saving ? "Saving…" : "Log reading"}</button>
          </form>
          <div className="backend-actions">
            <a href="http://127.0.0.1:8000/docs" target="_blank" rel="noreferrer">Open API docs ↗</a>
            <button type="button" onClick={startRetraining} disabled={retraining || !health?.model_exists}>{retraining ? "Starting…" : "Retrain model"}</button>
          </div>
          {statusMessage && <p className="form-message" role="status">{statusMessage}</p>}
          {errorMessage && zones && <p className="form-error" role="alert">{errorMessage}</p>}
        </article>
      </div>
      <p className="overview-disclaimer">{metrics?.note ?? "Synthetic-model scores describe simulator performance, not proven real-world accuracy."}</p>
    </section>
  );
}
