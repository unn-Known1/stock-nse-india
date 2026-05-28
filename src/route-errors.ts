import { Response } from 'express'

export function errorMessage(error: unknown): string {
    if (error instanceof Error) return error.message
    if (typeof error === 'string') return error
    try {
        return JSON.stringify(error)
    } catch {
        return 'Unknown error'
    }
}

export function httpStatusFromError(error: unknown): number {
    const message = errorMessage(error)
    if (message.startsWith('MCP Client Error')) return 502
    if (/\b(403)\b/.test(message)) return 403
    if (/\b(404)\b/.test(message)) return 404
    if (/\b(401)\b/.test(message)) return 401
    if (/\b(400)\b/.test(message)) return 400
    return 502
}

export function sendRouteError(res: Response, error: unknown): void {
    res.status(httpStatusFromError(error)).json({ error: errorMessage(error) })
}
