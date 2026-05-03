// apps/backend/src/services/spam-analysis.service.ts
import 'multer';
import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { z } from 'zod';
import { MLClientService } from './ml-client.service.js';
import { SpamAnalysisEntity } from '../entity/spam-analysis.entity.js';
import type {
  AnalysisId, PostId, UserId, Confidence, ISOTimestamp,
  SpamAnalysisResult, SpamResultByLabel, SpamLabel,
  AnalyzePostData, AnalysisRecord, StatsData, PaginatedData,
  TrainData,
} from '../shared/index.js';
import {
  toAnalysisId, toSanitized, toRawContent, toISOTimestamp, toConfidence,
} from '../shared/index.js';

// Zod schema для AnalyzePost request — branded types через transform
export const AnalyzePostSchema = z.object({
  postId:   z.string().min(1).transform(s => s as PostId),
  userId:   z.string().min(1).transform(s => s as UserId),
  content:  z.string().min(1).max(10_000),
  platform: z.enum(['twitter', 'facebook', 'instagram', 'telegram', 'reddit', 'bluesky']),
  language: z.enum(['uk', 'en', 'de', 'fr', 'pl']).default('en'),
});

export type AnalyzePostDto = z.infer<typeof AnalyzePostSchema>;

export interface GetHistoryOptions {
  readonly page:     number;
  readonly pageSize: number;
  readonly label?:   SpamLabel;
}

@Injectable()
export class SpamAnalysisService {
  private readonly logger = new Logger(SpamAnalysisService.name);

  constructor(
    private readonly mlClient: MLClientService,
    @InjectRepository(SpamAnalysisEntity)
    private readonly repo: Repository<SpamAnalysisEntity>,
  ) {}

  async analyze(dto: AnalyzePostDto): Promise<AnalyzePostData> {
    const sanitized = toSanitized(dto.content);
    const mlResult  = await this.mlClient.analyze(sanitized, dto.language, dto.platform);

    // Конвертуємо raw ML response → строгий discriminated union
    const result = this.buildResult(mlResult);

    const entity = this.repo.create({
      id:               mlResult.analysis_id,
      postId:           dto.postId,
      userId:           dto.userId,
      sanitizedContent: sanitized,
      platform:         dto.platform,
      language:         dto.language,
      result,
    });

    try {
      const saved = await this.repo.save(entity);
      this.logger.log(`Saved analysis id=${saved.id} label=${result.label} createdAt=${saved.createdAt}`);
    } catch (err) {
      this.logger.error('Failed to save analysis entity', err instanceof Error ? err.stack : String(err));
      throw err;
    }

    return {
      analysisId: mlResult.analysis_id,
      postId:     dto.postId,
      result,
    };
  }

  async getById(id: AnalysisId): Promise<AnalysisRecord> {
    const entity = await this.repo.findOneBy({ id });
    if (!entity) throw new NotFoundException(`Analysis ${id} not found`);
    return this.toRecord(entity);
  }

  async getHistory(
    userId:  UserId,
    options: GetHistoryOptions,
  ): Promise<PaginatedData<AnalysisRecord>> {
    const { page, pageSize, label } = options;

    const [entities, total] = await this.repo.findAndCount({
      where: {
        userId,
        ...(label ? {} : {}), // label фільтр через result.label в JSON потребує raw query
      },
      order:  { createdAt: 'DESC' },
      skip:   (page - 1) * pageSize,
      take:   pageSize,
    });

    return {
      items:    entities.map(e => this.toRecord(e)),
      total,
      page,
      pageSize,
      hasNext:  total > page * pageSize,
    };
  }

  async getStats(from: ISOTimestamp, to: ISOTimestamp): Promise<StatsData> {
    const fromDate = new Date(from);
    const toDate   = new Date(to);
    const entities = await this.repo.find({
      where: { createdAt: Between(fromDate, toDate) as unknown as ISOTimestamp },
    });
    this.logger.log(
      `getStats from=${fromDate.toISOString()} to=${toDate.toISOString()} found=${entities.length}`,
    );

    const byLabel = entities.reduce(
      (acc, e) => {
        const label = e.result.label;
        acc[label] = (acc[label] ?? 0) + 1;
        return acc;
      },
      {} as Record<SpamLabel, number>,
    );

    const total         = entities.length;
    const avgConfidence = toConfidence(
      total > 0
        ? entities.reduce((s, e) => s + e.result.confidence, 0) / total
        : 0,
    );

    return { total, byLabel, avgConfidence, period: { from, to } };
  }

  async train(file: Express.Multer.File): Promise<TrainData> {
    return this.mlClient.train(file);
  }

  // ── Private: ML response → discriminated union ─────────────────────────
  private buildResult(
    ml: Awaited<ReturnType<MLClientService['analyze']>>,
  ): SpamAnalysisResult {
    const base = {
      confidence: ml.confidence,
      flaggedAt:  ml.processed_at,
    } as const;

    if (ml.label === 'spam' || ml.label === 'suspicious') {
      return {
        ...base,
        label:    ml.label,
        severity: ml.severity ?? 'low',
        reasons:  ml.reasons as SpamResultByLabel<'spam'>['reasons'],
      };
    }
    if (ml.label === 'needs_review') {
      return {
        ...base,
        label:      'needs_review',
        reviewNote: ml.review_note ?? 'Manual review required',
      };
    }
    return { ...base, label: 'not_spam' };
  }

  private toRecord(e: SpamAnalysisEntity): AnalysisRecord {
    return {
      id:        e.id,
      postId:    e.postId,
      userId:    e.userId,
      platform:  e.platform,
      language:  e.language,
      result:    e.result,
      createdAt: e.createdAt,
    };
  }
}