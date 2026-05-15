export interface ApiOk {
  ok: true;
  [key: string]: unknown;
}

export interface ApiError {
  ok?: false;
  error?: string;
  message?: string;
  [key: string]: unknown;
}

export type ApiResponse = ApiOk | ApiError;
