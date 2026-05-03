import type { PostId, UserId, AnalysisId, Confidence, ISOTimestamp } from "./brand";
import type { SpamAnalysisResult, SpamLabel, Platform, language, language as Language } from "./spam";

export type { Language };

export interface ResponseMeta {
    readonly requestId: string
    readonly timestamp: ISOTimestamp
    readonly version: string
}

export interface ApiSuccess<T>{
    readonly success: true
    readonly data: T
    readonly meta: ResponseMeta
}

export interface ApiError{
    readonly success: false
    readonly error: {
        readonly code: ErrorCode
        readonly message: string
        readonly details: ReadonlyArray<{ field: string; message: string }>
    }
    readonly meta: ResponseMeta
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError

export interface ResponseMeta{
    readonly requestId: string
    readonly timestamp: ISOTimestamp
    readonly version: string
}

export type ErrorCode =  
    'VALIDATION_ERROR'
    | 'ML_SERVICE_UNAVAILABLE'
    | 'CONTENT_TOO_LONG'
    | 'RATE_LIMIT_EXCEED'
    | 'NOT_FOUND'
    | 'UNAUTHORIZED'

export interface AnalyzePostRequest{
    readonly postId: string
    readonly userId: string
    readonly content: string
    readonly platform: Platform
    readonly language: language
}

export interface AnalyzePostData{
    readonly analysisId: AnalysisId
    readonly postId: PostId
    readonly result: SpamAnalysisResult
}

export type AnalyzePostResponse = ApiSuccess<AnalyzePostData>

export interface AnalysisRecord {
    readonly id: AnalysisId
    readonly postId: PostId
    readonly userId: UserId
    readonly platform: Platform
    readonly language: language
    readonly result: SpamAnalysisResult
    readonly createdAt: ISOTimestamp
}

export type GetAnalysisResponse = ApiSuccess<AnalysisRecord>
export type GetHistoryResponse = ApiSuccess<PaginatedData<AnalysisRecord>>

export interface PaginatedData<T> {
    readonly items: ReadonlyArray<T>
    readonly total: number
    readonly page: number
    readonly pageSize: number
    readonly hasNext: boolean
}

export interface StatsData {
    readonly total: number
    readonly byLabel: Record<SpamLabel, number>
    readonly avgConfidence: Confidence
    readonly period: { from: ISOTimestamp; to: ISOTimestamp }
}

export type GetStatsResponse = ApiSuccess<StatsData>

export interface TrainData {
    readonly samples: number
    readonly test_accuracy: number
    readonly label_counts: Record<string, number>
}

export type TrainResponse = ApiSuccess<TrainData>

export interface MLAnalyzePayload {
    readonly content: string
    readonly language: language
    readonly platform: Platform
}

export interface MLAnalyzeResponse {
    readonly analysis_id: string
    readonly label: SpamLabel
    readonly confidence: number
    readonly severity?: 'low' | 'medium' | 'high' | 'critical'
    readonly reasons: string[]
    readonly review_note?: string
    readonly processed_at: string
}