export type UploadFileParams = {
  filePath: string;
  key: string;
  contentType?: string;
};

export type UploadFileResult = {
  location: string;
  key: string;
  bucket: string;
};
