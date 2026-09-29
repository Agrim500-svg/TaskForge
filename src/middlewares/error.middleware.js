import { ApiError } from "../utils/api-error.js";
import { ApiResponse } from "../utils/api-response.js";

export const errorMiddleware = (error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  const apiError = error instanceof ApiError
    ? error
    : new ApiError(500, "Internal server error");

  if (!(error instanceof ApiError)) {
    console.error(error);
  }

  return res.status(apiError.statusCode).json({
    ...new ApiResponse(apiError.statusCode, apiError.data, apiError.message),
    errors: apiError.errors,
  });
};
