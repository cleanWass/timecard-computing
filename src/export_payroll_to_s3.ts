import express from 'express';
import * as E from 'fp-ts/Either';
import * as TE from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/function';
import { LocalDate, } from '@js-joda/core';
import fs from 'fs';
import path from 'path';
import AWS from 'aws-sdk';
import dotenv from 'dotenv';
import { LocalDateRange } from './domain/models/local-date-range';
import { prepareEnv } from './application/csv-generation/prepare-env';
import { generatePayrollExports } from './generate-csv-payroll';

dotenv.config();

const app = express();
app.use(express.json());

const s3 = new AWS.S3();

app.post('/download-export', async (req, res) => {
  console.log('/download-export', { body: req.body, params: req.params });

  const parseRequest = (): E.Either<Error, { period: LocalDateRange; type: string; env: any }> => {
    try {
      const startDate = LocalDate.parse(req.body.startDate);
      const endDate = LocalDate.parse(req.body.endDate);
      const type = req.body.type;
      const period = new LocalDateRange(startDate, endDate);

      const env = prepareEnv({
        persistence: 'rh',
        period,
        debug: false,
        displayLog: true,
      });

      return E.right({ period, type, env });
    } catch (error) {
      return E.left(new Error('Invalid input parameters.'));
    }
  };

  const uploadToS3 = (filePath: string, key: string): TE.TaskEither<Error, string> =>
    TE.tryCatch(
      () =>
        new Promise((resolve, reject) => {
          const fileStream = fs.createReadStream(filePath);
          const uploadParams = {
            Bucket: process.env.AWS_S3_BUCKET_NAME || 'payrollexports',
            Key: key,
            Body: fileStream,
            ContentType: 'text/csv',
          };
          setTimeout(() => {
            s3.upload(uploadParams, (err, data) => {
              if (err) {
                reject(err);
              } else {
                resolve(data.Location);
              }
            });
          }, 5000);
        }),
      (reason) => new Error(`Failed to upload to S3: ${reason}`)
    );

  await pipe(
    TE.fromEither(parseRequest()),
    TE.chain(({ period, type, env }) =>
      pipe(
        generatePayrollExports({ period, env }),
        TE.chainW(() => {
          // Étape 3 : Fin des streams et préparation de l'upload
          Object.values(env.cvsStream).forEach((stream: any) => stream.end());
          const filePath = path.join(process.cwd(), `/exports/rendu/${type}.csv`);
          console.log('Uploading file to S3:', filePath);
          return uploadToS3(filePath, `exports/${type}.csv`); // Étape 4 : Envoi sur S3
        })
      )
    ),
    TE.match(
      (error) => {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
      },
      (s3Url) => {
        console.log('File uploaded successfully:', s3Url);
        res.status(200).json({ downloadUrl: s3Url });
      }
    )
  )();
});
