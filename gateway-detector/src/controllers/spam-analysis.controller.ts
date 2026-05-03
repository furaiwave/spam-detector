// apps/backend/src/controllers/spam-analysis.controller.ts
import 'multer';
import {
  Controller, Post, Get, Body, Param, Query,
  UsePipes, HttpCode, HttpStatus, ParseIntPipe,
  DefaultValuePipe, UploadedFile, UseInterceptors, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe.js';
import {
  SpamAnalysisService,
  AnalyzePostSchema,
  type AnalyzePostDto,
} from '../services/spam-analysis.service.js';
import type {
  ApiSuccess, AnalyzePostResponse, GetAnalysisResponse,
  GetHistoryResponse, GetStatsResponse, TrainResponse,
  AnalysisId, UserId, ISOTimestamp, ResponseMeta,
} from '../shared/index.js';
import { toAnalysisId, toISOTimestamp } from '../shared/index.js';
import { randomUUID } from 'crypto';

// Helper — інферить T із data, щоб не писати вручну
function ok<T>(data: T): ApiSuccess<T> {
  return {
    success: true,
    data,
    meta:    buildMeta(),
  };
}

function buildMeta(): ResponseMeta {
  return {
    requestId: randomUUID(),
    timestamp: new Date().toISOString() as ISOTimestamp,
    version:   '1.0.0',
  };
}

@Controller('api/v1/spam')
export class SpamAnalysisController {
  constructor(private readonly service: SpamAnalysisService) {}

  @Post('analyze')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(AnalyzePostSchema))
  async analyze(@Body() dto: AnalyzePostDto): Promise<AnalyzePostResponse> {
    const data = await this.service.analyze(dto);
    return ok(data);
  }

  @Get('history')
  async getHistory(
    @Query('userId') userId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(20), ParseIntPipe) pageSize: number,
  ): Promise<GetHistoryResponse> {
    const data = await this.service.getHistory(userId as UserId, {
      page,
      pageSize: Math.min(pageSize, 100),
    });
    return ok(data);
  }

  @Get('stats')
  async getStats(
    @Query('from') from: string,
    @Query('to')   to:   string,
  ): Promise<GetStatsResponse> {
    const data = await this.service.getStats(
      toISOTimestamp(from),
      toISOTimestamp(to),
    );
    return ok(data);
  }

  @Post('train')
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  }))
  async train(@UploadedFile() file?: Express.Multer.File): Promise<TrainResponse> {
    if (!file) throw new BadRequestException('CSV file is required (field name: "file")');
    const data = await this.service.train(file);
    return ok(data);
  }

  @Get(':id')
  async getAnalysis(@Param('id') id: string): Promise<GetAnalysisResponse> {
    const data = await this.service.getById(toAnalysisId(id));
    return ok(data);
  }
}