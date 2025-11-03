import * as AWS from 'aws-sdk';
import * as TE from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/function';
import fs from 'fs';
import { EnvService } from '../../../config/env';
import { UploadFileParams, UploadFileResult } from './types';

export type S3Service = {
  uploadFile: (params: UploadFileParams) => TE.TaskEither<Error, UploadFileResult>;
};

export const makeS3Service = (s3Client: AWS.S3): S3Service => ({
  uploadFile: ({ filePath, key, contentType = 'text/csv' }) =>
    pipe(
      TE.tryCatch(
        () =>
          new Promise<UploadFileResult>((resolve, reject) => {
            const fileStream = fs.createReadStream(filePath);

            const uploadParams: AWS.S3.PutObjectRequest = {
              Bucket: EnvService.get('AWS_S3_BUCKET_NAME'),
              Key: key,
              Body: fileStream,
              ContentType: contentType,
            };

            s3Client.upload(uploadParams, (err, data) => {
              if (err) {
                reject(new Error(`S3 upload failed: ${err.message}`));
              } else {
                resolve({
                  location: data.Location,
                  key: data.Key,
                  bucket: data.Bucket,
                });
              }
            });
          }),
        error => new Error(`Failed to upload file: ${error}`)
      )
    ),
});
