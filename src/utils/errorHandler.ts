/**
 * Error handling utilities for sanitizing API errors
 * Prevents exposure of sensitive internal details to users
 */

export interface SanitizedError {
    message: string;
    code?: string;
}

/**
 * Sanitizes error messages to prevent exposure of sensitive information
 * @param error - The error to sanitize
 * @param fallbackMessage - Default message to show users
 * @returns Sanitized error message safe for user display
 */
export function sanitizeError(error: unknown, fallbackMessage = "An error occurred"): SanitizedError {
    // If it's not an error object, return fallback
    if (!(error instanceof Error)) {
        console.error("Non-error object thrown:", error);
        return { message: fallbackMessage };
    }

    const errorMessage = error.message.toLowerCase();

    // Handle rate limit errors first (before generic validation check)
    if (errorMessage.includes("rate limit exceeded")) {
        return { message: error.message, code: "RATE_LIMITED" }; // Return original message with proper casing
    }

    // Handle specific known error patterns that are safe to show
    if (errorMessage.includes("not found")) {
        return { message: "The requested resource was not found", code: "NOT_FOUND" };
    }

    if (errorMessage.includes("unauthorized") || errorMessage.includes("forbidden")) {
        return { message: "You don't have permission to perform this action", code: "UNAUTHORIZED" };
    }

    if (errorMessage.includes("validation") || errorMessage.includes("invalid")) {
        return { message: "The provided data is invalid", code: "VALIDATION_ERROR" };
    }

    if (errorMessage.includes("network") || errorMessage.includes("fetch")) {
        return { message: "Network error occurred. Please try again", code: "NETWORK_ERROR" };
    }

    if (errorMessage.includes("timeout")) {
        return { message: "Request timed out. Please try again", code: "TIMEOUT" };
    }

    // For database errors, API errors, or any other internal errors,
    // log the full error but return a generic message
    console.error("Internal error:", {
        message: error.message,
        stack: error.stack,
        name: error.name
    });

    return { message: fallbackMessage };
}

/**
 * Sanitizes HTTP response errors
 * @param response - The HTTP response
 * @param fallbackMessage - Default message to show users
 * @returns Sanitized error message
 */
export async function sanitizeHttpError(
    response: Response,
    fallbackMessage = "Request failed"
): Promise<SanitizedError> {
    try {
        // Try to parse error response
        const errorText = await response.text();

        // If response has a JSON error format, try to extract safe information
        try {
            const errorJson = JSON.parse(errorText);
            if (errorJson.error && typeof errorJson.error === "string") {
                return sanitizeError(new Error(errorJson.error), fallbackMessage);
            }
            if (errorJson.message && typeof errorJson.message === "string") {
                return sanitizeError(new Error(errorJson.message), fallbackMessage);
            }
        } catch {
            // Not JSON, continue with text processing
        }

        // Handle common HTTP status codes
        switch (response.status) {
            case 400:
                return { message: "Invalid request", code: "BAD_REQUEST" };
            case 401:
                return { message: "Authentication required", code: "UNAUTHORIZED" };
            case 403:
                return { message: "Access denied", code: "FORBIDDEN" };
            case 404:
                return { message: "Resource not found", code: "NOT_FOUND" };
            case 409:
                return { message: "Conflict with existing data", code: "CONFLICT" };
            case 422:
                return { message: "Invalid data provided", code: "VALIDATION_ERROR" };
            case 429:
                return { message: "Too many requests. Please try again later", code: "RATE_LIMITED" };
            case 500:
                return { message: "Server error occurred", code: "SERVER_ERROR" };
            case 502:
            case 503:
            case 504:
                return { message: "Service temporarily unavailable", code: "SERVICE_UNAVAILABLE" };
            default:
                // Log the full error for debugging but don't expose it
                // console.error("HTTP error:", {
                //     status: response.status,
                //     statusText: response.statusText,
                //     url: response.url,
                //     body: errorText
                // });
                return { message: fallbackMessage, code: "UNKNOWN_ERROR" };
        }
    } catch (parseError) {
        console.error("Error parsing HTTP error response:", parseError);
        return { message: fallbackMessage, code: "PARSE_ERROR" };
    }
}

/**
 * Creates a user-friendly error message for toast notifications
 * @param error - The sanitized error
 * @returns User-friendly message for display
 */
export function getDisplayMessage(error: SanitizedError): string {
    return error.message;
} 