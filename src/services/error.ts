import type { Response } from "express";

export function createError(
    errorCode: string,
    errorMessage: string,
    messageVars: any[] | undefined,
    numericErrorCode: number,
    errorType: string | undefined,
    statusCode: number,
    res: Response
): void {
    res.set({
        "X-Epic-Error-Name": errorCode,
        "X-Epic-Error-Code": String(numericErrorCode)
    });

    res.status(statusCode).json({
        errorCode,
        errorMessage,
        messageVars: messageVars || [],
        numericErrorCode,
        originatingService: "any",
        intent: "prod",
        error_description: errorMessage,
        error: errorType
    });
}
