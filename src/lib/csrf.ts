import csrf from 'csrf';

const tokens = new csrf();
const CSRF_SECRET = process.env.CSRF_SECRET || "N76P9eIuG68d7GZhKGmvzCD7";

export function generateCSRFToken() {
    return tokens.create(CSRF_SECRET);
}

export function verifyCSRFToken(token: string) {
    return tokens.verify(CSRF_SECRET, token);
}

export function withCSRF(handler: any) {
    return async (req: Request, ...args: any[]) => {
        if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
            return handler(req, ...args);
        }
        const csrfToken = req.headers.get('x-csrf-token') || '';
        if (!csrfToken || !verifyCSRFToken(csrfToken)) {
            return new Response(JSON.stringify({ error: 'Invalid CSRF token' }), { status: 403 });
        }
        return handler(req, ...args);
    };
} 