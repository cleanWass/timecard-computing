import * as AWS from 'aws-sdk';
import { pipe } from 'fp-ts/function';
import * as TE from 'fp-ts/TaskEither';
import {
  FileStoragePort,
  UploadFileResult,
} from '../../../application/ports/services/file-storage-port';

export const makeS3Service = (s3Client: AWS.S3): FileStoragePort => ({
  uploadFile: ({ bucketName: Bucket, content: Body, fileName: Key, contentType = 'text/csv' }) =>
    pipe(
      TE.tryCatch(
        () =>
          new Promise<UploadFileResult>((resolve, reject) => {
            const uploadParams: AWS.S3.PutObjectRequest = {
              Bucket,
              Key,
              Body,
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
