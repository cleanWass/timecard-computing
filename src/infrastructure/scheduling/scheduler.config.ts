import { EnvService } from '../../config/env';

export const schedulerConfig = {
  benchManagement: {
    enabled: EnvService.get('INTERCONTRACT_SCHEDULER_ENABLED') === 'true',
    schedule: EnvService.get('INTERCONTRACT_CRON_SCHEDULE') || '0 8,17 * * *',
  },
};
