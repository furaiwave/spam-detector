export type SpamLabel = 'spam' | 'not_spam' | 'suspicious' | 'needs_review'
export type SpamSeverity = 'low' | 'medium' | 'high' | 'critical'
export type SpamCategory = 
    'spam:phishing' 
    | 'spam:commercial'
    | 'spam:bot_activity'
    | 'spam:hate_speech'
    | 'spam:missinformation'
    | 'spam:repetitive_content'

export type Platform = 'twitter' | 'facebook' | 'instagram' | 'telegram' | 'reddit' | 'bluesky'
export type language = 'uk' | 'en' | 'de' | 'fr' | 'pl'

export type SpamResultByLabel<L extends SpamLabel> = 
    L extends 'spam' | 'suspicious'
    ? {
        readonly label: L
        readonly confidence: import('./brand').Confidence
        readonly severity: SpamSeverity
        readonly reasons: ReadonlyArray<SpamCategory>
        readonly flaggedAt: import('./brand').ISOTimestamp
    }
    : L extends 'needs_review'
    ? {
        readonly label: L
        readonly confidence: import('./brand').Confidence
        readonly saverity?: never
        readonly reviewNote: string
        readonly flaggedAt: import('./brand').ISOTimestamp
    } : {
        readonly label: L
        readonly confidence: import('./brand').Confidence
        readonly severity?: never
        readonly flaggedAt: import('./brand').ISOTimestamp
    }

export type SpamAnalysisResult = 
    | SpamResultByLabel<'spam'>
    | SpamResultByLabel<'not_spam'>
    | SpamResultByLabel<'suspicious'>
    | SpamResultByLabel<'needs_review'>

export const isSpam = (r: SpamAnalysisResult): r is SpamResultByLabel<'spam'> => r.label === 'spam'

export const isThreat = (
    r: SpamAnalysisResult,
) : r is SpamResultByLabel<'spam'> | SpamResultByLabel<'suspicious'> => r.label === 'spam' || r.label === 'suspicious'

export const isClean = (r: SpamAnalysisResult): r is SpamResultByLabel<'not_spam'> => r.label === 'not_spam'