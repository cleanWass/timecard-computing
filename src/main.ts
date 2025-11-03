import './config/env';
import { EnvService } from './config/env';
import { serverConfig } from './config/server.config';
import { configureAWS, createS3Client } from './config/aws.config';
import { makeApp } from './presentation/http/app';
import { makeS3Service } from './infrastructure/storage/s3/s3.service';


const start = async () => {
  try {
    console.log('🔧 Configuring AWS...');
    configureAWS();

    console.log('📦 Creating dependencies...');
    const s3Client = createS3Client();
    const s3Service = makeS3Service(s3Client);

    console.log('🚀 Creating Express app...');
    const app = makeApp({ s3Service });

    app.listen(serverConfig.port, () => {
      console.log('');
      console.log('✅ Timecard Computing Server is running');
      console.log(`   Port: ${serverConfig.port}`);
      console.log(`   Environment: ${serverConfig.nodeEnv}`);
      console.log(`   AWS Region: ${EnvService.get('AWS_REGION')}`);
      console.log('');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

start();
