import { EnvService } from './env';

export const serverConfig = {
  port: parseInt(EnvService.get('PORT', '3001'), 10),
  nodeEnv: EnvService.get('NODE_ENV', 'development'),
  isDevelopment: EnvService.get('NODE_ENV', 'development') === 'development',
  isProduction: EnvService.get('NODE_ENV', 'development') === 'production',
} as const;
