import { Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import type {
  AnalysisId, PostId, UserId, SanitizedContent, ISOTimestamp,
} from '../shared/brand';
import type { SpamAnalysisResult, Platform, language } from '../shared/spam';

@Entity('spam_analyses')
export class SpamAnalysisEntity {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id!: AnalysisId;

  @Column({ type: 'varchar', length: 36, name: 'post_id' })
  postId!: PostId;

  @Column({ type: 'varchar', length: 36, name: 'user_id' })
  userId!: UserId;

  @Column({ type: 'text', name: 'sanitized_content' })
  sanitizedContent!: SanitizedContent;

  @Column({ type: 'enum', enum: ['twitter','facebook','instagram','telegram','reddit','bluesky'] })
  platform!: Platform;

  @Column({ type: 'enum', enum: ['uk','en','de','fr','pl'] })
  language!: language;

  // JSON column — зберігаємо увесь discriminated union як-є
  @Column({ type: 'json' })
  result!: SpamAnalysisResult;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: ISOTimestamp;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: ISOTimestamp;
}