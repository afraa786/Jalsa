import type {
  DayForecast,
  Festival,
  Heatmap,
  LogReadingInput,
  LogReadingResult,
  ModelMetrics,
  Prediction,
  ServiceHealth,
  ZoneInfo,
} from "@/types/jalsa";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";
const MAX_ATTEMPTS = 2;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const response = await fetch(`${API_URL}${path}`, {
        ...init,
        signal: controller.signal,
        headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
      });
      clearTimeout(timeout);

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail ?? `Request failed with status ${response.status}`);
      }

      return await response.json() as Promise<T>;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("The JALSA API is unavailable");
      if (attempt === MAX_ATTEMPTS - 1) break;
    }
  }

  throw lastError ?? new Error("The JALSA API is unavailable");
}

export const getZones = () => request<ZoneInfo>("/zones");
export const getFestivals = () => request<Festival[]>("/festivals");
export const getHealth = () => request<ServiceHealth>("/health");
export const getMetrics = () => request<ModelMetrics>("/metrics");
export const getForecast = (zone: string, date: string, rain: boolean) =>
  request<DayForecast>(`/forecast/day?zone=${encodeURIComponent(zone)}&date=${date}&rain=${rain}`);
export const getPrediction = (zone: string, date: string, hour: number, rain: boolean) =>
  request<Prediction>("/predict", {
    method: "POST",
    body: JSON.stringify({ zone, date, hour, rain }),
  });
export const getHeatmap = (zone: string, start: string, days: number, rain: boolean) =>
  request<Heatmap>(`/forecast/heatmap?zone=${encodeURIComponent(zone)}&start=${start}&days=${days}&rain=${rain}`);
export const logReading = (reading: LogReadingInput) =>
  request<LogReadingResult>("/log", { method: "POST", body: JSON.stringify(reading) });
export const retrainModel = () =>
  request<{ status: string }>("/retrain", { method: "POST" });
