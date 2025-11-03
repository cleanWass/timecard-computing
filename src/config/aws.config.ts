import * as AWS from 'aws-sdk';
import { EnvService } from './env';

export const configureAWS = (): void => {
  AWS.config.update({
    accessKeyId: EnvService.get('AWS_ACCESS_KEY_ID'),
    secretAccessKey: EnvService.get('AWS_SECRET_ACCESS_KEY'),
    region: EnvService.get('AWS_REGION'),
  });
};

export const createS3Client = (): AWS.S3 => {
  return new AWS.S3();
};
