export function documentFetchError(status: number, errorId?: string | null): string {
  let message: string;
  if (status === 401) message = "Сессия истекла. Войдите снова";
  else if (status === 403) message = "Недостаточно прав для просмотра документа";
  else if (status === 404) message = "Документ не найден";
  else if (status === 409) message = "Документ пока не готов. Обновите данные и повторите";
  else if (status >= 500) message = "Не удалось сформировать документ. Повторите попытку";
  else message = `Не удалось получить документ (${status})`;
  return errorId ? `${message}. Код ошибки: ${errorId}` : message;
}