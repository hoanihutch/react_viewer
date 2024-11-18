// src/types/visualization.ts
export interface VisualizationData {
    // Define your data structure here based on Julia output
    // Example:
    points?: Array<{ x: number; y: number; z: number }>;
    metadata?: Record<string, unknown>;
  }