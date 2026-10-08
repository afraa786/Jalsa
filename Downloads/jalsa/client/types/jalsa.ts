export type CrowdLevel = "Low" | "Moderate" | "High" | "Very High";

export interface ZoneInfo {
  zones: string[];
  places: Array<{ name: string; zone: string }>;
  levels: CrowdLevel[];
}

export interface Prediction {
  zone: string;
  date: string;
  hour: number;
  rain: boolean;
  level: CrowdLevel;
  confidence: number;
  probabilities: Record<CrowdLevel, number>;
  expected_crowd: number;
  monte_carlo: {
    p10: number;
    p50: number;
    p90: number;
    prob_high_or_more: number;
  };
}

export interface HourForecast {
  hour: number;
  expected_crowd: number;
  level: CrowdLevel;
  confidence: number;
}

export interface DayForecast {
  zone: string;
  date: string;
  rain: boolean;
  hourly: HourForecast[];
  best_hours: HourForecast[];
}

export interface Festival {
  date: string;
  name: string;
  weight: number;
  days_away: number;
}

export interface HeatmapDay {
  date: string;
  hours: number[];
  expected_crowd: number[];
}

export interface Heatmap {
  zone: string;
  start: string;
  days: number;
  rain: boolean;
  data: HeatmapDay[];
}
