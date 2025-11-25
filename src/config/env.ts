import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

const envEntries = [
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_REGION',
  'AWS_S3_BUCKET_NAME',
  'AWS_S3_BENCH_MANAGEMENT_BUCKET_NAME',
  'NODE_ENV',
  'PORT',
  'LOG_LEVEL',
  'CARE_DATA_PARSER_URL',
  'CARE_DATA_PARSER_API_KEY',
  'INTERCONTRACT_SCHEDULER_ENABLED',
  'INTERCONTRACT_CRON_SCHEDULE',
] as const;

type EnvKey = (typeof envEntries)[number];

class EnvServiceClass {
  private loaded = false;
  private readonly root: string;

  constructor() {
    // Use the process working directory to reliably point to the project root
    // When compiled, __dirname points to build/src/config, which would resolve to build/ if we used ".., .."
    // process.cwd() stays at the repo root where the .env files live.
    this.root = process.cwd();
    this.load();
  }

  private load() {
    if (this.loaded) return;
    const env = process.env.NODE_ENV || 'development';
    const candidates = [
      path.join(this.root, `.env.local`),
      path.join(this.root, `.env.${env}`),
      path.join(this.root, `.env`),
    ];

    for (const file of candidates) {
      if (fs.existsSync(file)) {
        const result = dotenv.config({ path: file });
        if (result.error) {
          if (process.env.DEBUG_ENV_LOAD === '1') {
            console.warn(`[env] Failed to load ${file}:`, result.error);
          }
        } else if (process.env.DEBUG_ENV_LOAD === '1') {
          console.log(`[env] Loaded ${file}`);
        }
        break;
      }
    }

    this.loaded = true;
  }

  get(name: EnvKey, defaultValue = '') {
    if (!envEntries.includes(name as EnvKey)) {
      if (process.env.DEBUG_ENV_LOAD === '1') {
        console.warn(`[env] Attempted to access unknown key: ${name}`);
      }
      return defaultValue;
    }
    const val = process.env[name];
    return val !== undefined ? val : defaultValue;
  }

  require(name: EnvKey): string {
    if (!envEntries.includes(name as EnvKey)) {
      throw new Error(`Unknown environment variable requested: ${name}`);
    }
    const val = process.env[name];
    if (!val || val.trim() === '') {
      throw new Error(`Missing required environment variable: ${name}`);
    }
    return val;
  }

  exposeAll() {
    return process.env;
  }
}

export const EnvService = new EnvServiceClass();
