import * as TE from 'fp-ts/TaskEither';

export type UploadFileParams = {
  bucketName: string;
  fileName: string;
  content: string;
  contentType?: string;
};

export type UploadFileResult = {
  location: string;
  key: string;
  bucket: string;
};

export type FileStoragePort = {
  uploadFile: (params: UploadFileParams) => TE.TaskEither<Error, UploadFileResult>;
};
