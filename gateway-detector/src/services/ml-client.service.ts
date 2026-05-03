// apps/backend/src/services/ml-client.service.ts
import 'multer';
import { Injectable, ServiceUnavailableException, BadRequestException, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom, timeout } from 'rxjs';
import { z } from 'zod';
import FormData from 'form-data';
import type { EnvConfig } from '../config/env.config.js';
import type {
  MLAnalyzePayload, MLAnalyzeResponse,
  SanitizedContent, Language, Platform,
  TrainData,
} from '../shared/index.js';
import {
  toAnalysisId, toConfidence, toISOTimestamp,
} from '../shared/index.js';

const TRAIN_TIMEOUT_MS = 5 * 60 * 1000;

const TrainResponseSchema = z.object({
  samples:       z.number().int().positive(),
  test_accuracy: z.number().min(0).max(1),
  label_counts:  z.record(z.string(), z.number().int().nonnegative()),
});

// Zod schema для Python response — не довіряємо зовнішньому сервісу
const MLResponseSchema = z.object({
  analysis_id:  z.string().min(1).transform(toAnalysisId),
  label:        z.enum(['spam', 'not_spam', 'suspicious', 'needs_review']),
  confidence:   z.number().min(0).max(1).transform(toConfidence),
  severity:     z.enum(['low', 'medium', 'high', 'critical']).nullish(),
  reasons:      z.array(z.string()).nullish().transform(v => v ?? []),
  review_note:  z.string().nullish(),
  processed_at: z.string().transform(toISOTimestamp),
});

// Інферимо тип після transform — не пишемо вручну
type ValidatedMLResponse = z.infer<typeof MLResponseSchema>;

@Injectable()
export class MLClientService {
  private readonly logger = new Logger(MLClientService.name);

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService<EnvConfig, true>,
  ) {}

  async analyze(
    content:  SanitizedContent,
    language: Language,
    platform: Platform,
  ): Promise<ValidatedMLResponse> {
    const payload: MLAnalyzePayload = { content, language, platform };
    const timeoutMs = this.config.get('ML_SERVICE_TIMEOUT_MS', { infer: true });

    // unknown тут необхідний: axios дає any, але ми валідуємо через Zod
    let raw: unknown;
    try {
      const res = await firstValueFrom(
        this.http
          .post<unknown>('/analyze', payload)
          .pipe(timeout(timeoutMs)),
      );
      raw = res.data;
    } catch (err) {
      this.logger.error('ML service unreachable', err);
      throw new ServiceUnavailableException('ML service is currently unavailable');
    }

    const parsed = MLResponseSchema.safeParse(raw);
    if (!parsed.success) {
      this.logger.error('ML service returned invalid shape', parsed.error.message);
      throw new ServiceUnavailableException(
        `ML service returned invalid response: ${parsed.error.message}`,
      );
    }

    return parsed.data;
  }

  async train(file: Express.Multer.File): Promise<TrainData> {
    const form = new FormData();
    form.append('file', file.buffer, {
      filename:    file.originalname,
      contentType: file.mimetype,
    });

    let raw: unknown;
    try {
      const res = await firstValueFrom(
        this.http
          .post<unknown>('/train', form, {
            headers: form.getHeaders(),
            timeout: TRAIN_TIMEOUT_MS,
            maxBodyLength:    Infinity,
            maxContentLength: Infinity,
          })
          .pipe(timeout(TRAIN_TIMEOUT_MS)),
      );
      raw = res.data;
    } catch (err: unknown) {
      const info = this.describeError(err);
      this.logger.error(`ML training failed: ${info.summary}`, info.full);
      if (info.detail) throw new BadRequestException(info.detail);
      throw new ServiceUnavailableException(`ML service training failed: ${info.summary}`);
    }

    const parsed = TrainResponseSchema.safeParse(raw);
    if (!parsed.success) {
      throw new ServiceUnavailableException(
        `ML training returned invalid response: ${parsed.error.message}`,
      );
    }
    return parsed.data;
  }

  private describeError(err: unknown): {
    summary: string;
    detail:  string | null;
    full:    string;
  } {
    const e = err as {
      message?: string;
      code?:    string;
      response?: { status?: number; data?: unknown };
    };
    const status = e.response?.status;
    const data   = e.response?.data;
    let detail: string | null = null;
    if (data && typeof data === 'object' && 'detail' in data) {
      const d = (data as { detail?: unknown }).detail;
      if (typeof d === 'string') detail = d;
      else if (d !== undefined)  detail = JSON.stringify(d);
    }
    const summary =
      detail ?? (status ? `HTTP ${status}` : (e.code ?? e.message ?? 'unknown error'));
    const full = JSON.stringify({
      message: e.message,
      code:    e.code,
      status,
      data:    typeof data === 'string' ? data.slice(0, 500) : data,
    });
    return { summary, detail, full };
  }
}