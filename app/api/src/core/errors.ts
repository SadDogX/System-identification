export class HttpError extends Error {
  status: number;
  details?: Record<string, string>;

  constructor(status: number, message: string, details?: Record<string, string>) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const badRequest = (message: string, details?: Record<string, string>) =>
  new HttpError(400, message, details);
export const unauthorized = (message = 'Требуется авторизация') => new HttpError(401, message);
export const forbidden = (message = 'Недостаточно прав') => new HttpError(403, message);
export const notFound = (message = 'Не найдено') => new HttpError(404, message);
export const conflict = (message: string) => new HttpError(409, message);
