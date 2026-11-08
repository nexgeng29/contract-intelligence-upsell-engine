// s3-service.mjs
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

export class S3Service {
  constructor() {
    this.client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      ...(process.env.S3_ENDPOINT && {
        endpoint: process.env.S3_ENDPOINT,
        forcePathStyle: true,
      }),
      ...(process.env.S3_ENDPOINT && {
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test',
        },
      }),
    });
  }

  async downloadFile(bucket, key, versionId) {
    console.log('Downloading file from S3', { bucket, key, versionId });

    const result = await this.client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
        ...(versionId && { VersionId: versionId }),
      })
    );

    const buffer = Buffer.from(await result.Body.transformToByteArray());
    console.log('File downloaded', { size: buffer.length });

    return buffer;
  }
}
