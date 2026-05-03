declare const __brand: unique symbol

export type Brand<T, B extends string> = T & { readonly [__brand]: B }

export type PostId = Brand<string, 'PostId'>
export type UserId = Brand<string, 'UserId'>
export type AnalysisId = Brand<string, 'AnalysisId'>
export type RawContent = Brand<string, 'RawContent'>
export type SanitizedContent = Brand<string, 'SanitizedContent'>
export type Confidence = Brand<number, 'Confidence'>
export type ISOTimestamp = Brand<string, 'ISOTimestamp'>

export const toPostId = (s: string): PostId => s as PostId
export const toUserId = (s: string): UserId => s as UserId
export const toAnalysisId = (s: string): AnalysisId => s as AnalysisId
export const toRawContent = (s: string): RawContent => s as RawContent
export const toISOTimestamp = (s: string): ISOTimestamp => s as ISOTimestamp
export const toSanitized = (s: string): SanitizedContent => s as SanitizedContent
export const toConfidence = (n: number): Confidence => {
    if(n < 0 || n > 1) throw new RangeError(`Confidence must be 0..1, got ${n}`)
    return n as Confidence;
}