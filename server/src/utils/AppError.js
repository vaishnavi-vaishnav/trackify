/**
 * An error a client is meant to see, carrying the status it should map to.
 *
 * Services throw these for expected outcomes (not found, forbidden, conflicting
 * state); anything else that reaches a controller is unexpected and becomes a
 * generic 500 without leaking internals.
 */
class AppError extends Error {
    constructor(message, statusCode = 400) {
        super(message);
        this.name = "AppError";
        this.statusCode = statusCode;
        this.expected = true;
        Error.captureStackTrace?.(this, AppError);
    }
}

/**
 * Standard controller catch: expected errors keep their message and status,
 * everything else is logged server-side and reported as a 500.
 */
const respondWithError = (res, error, context = "Request") => {
    if (error instanceof AppError) {
        return res.status(error.statusCode).json({
            success: false,
            message: error.message,
        });
    }

    console.error(`${context} failed:`, error);
    return res.status(500).json({
        success: false,
        message: "Internal server error.",
    });
};

module.exports = { AppError, respondWithError };
