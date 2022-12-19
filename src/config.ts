import { Module } from "./Module";
import { Module as SWCModule } from "@swc/core";
import { deepMerge } from "./helpers";

export interface UserPlugin {
  name: string;
  parse?(id: string, code: string): SWCModule | null;
  resolve?(
    id: string,
    config: Config,
    importer: Module | null
  ): string | null | undefined;
  load?(id: string, config: Config): string | null;
}

export interface Config {
  plugins: UserPlugin[];
}

export type UserConfig = Partial<Config>;

export function defineConfig(userConfig: UserConfig = {}): Config {
  const defaultConfig: Config = {
    plugins: [],
  };
  return deepMerge(defaultConfig, userConfig) as Config;
}
