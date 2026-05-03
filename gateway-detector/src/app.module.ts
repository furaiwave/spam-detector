import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, type TypeOrmModuleOptions } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { validateEnv, type EnvConfig } from './config/env.config.js';
import { SpamAnalysisEntity } from './entity/spam-analysis.entity.js';
import { SpamAnalysisController } from './controllers/spam-analysis.controller.js';
import { SpamAnalysisService } from './services/spam-analysis.service.js';
import { MLClientService } from './services/ml-client.service.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvConfig, true>): TypeOrmModuleOptions => ({
        type:     'mysql',
        host:     config.get('DB_HOST',     { infer: true }),
        port:     config.get('DB_PORT',     { infer: true }),
        username: config.get('DB_USERNAME', { infer: true }),
        password: config.get('DB_PASSWORD', { infer: true }),
        database: config.get('DB_DATABASE', { infer: true }),
        entities: [SpamAnalysisEntity],
        synchronize: true,
      }),
    }),
    TypeOrmModule.forFeature([SpamAnalysisEntity]),
    HttpModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvConfig, true>) => ({
        baseURL: config.get('ML_SERVICE_URL',        { infer: true }),
        timeout: config.get('ML_SERVICE_TIMEOUT_MS', { infer: true }),
      }),
    }),
  ],
  controllers: [SpamAnalysisController],
  providers:   [SpamAnalysisService, MLClientService],
})
export class AppModule {}
