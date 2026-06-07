export interface GreeterConfig {
  eventUrl: string;
}

export type GreeterPluginState = { config: GreeterConfig | null };
