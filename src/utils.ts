import { appConfig } from './config';

export function convertArrayToTable<T>(items: T[], columns: number): T[][] {
  const rows = Math.ceil(items.length / columns);

  const resultArray: T[][] = [];

  for (let i = 0; i < rows; i++) {
    const row = items.slice(i * columns, (i + 1) * columns);
    resultArray.push(row);
  }
  return resultArray;
}

export function generateWebAppUrl(path: string): string {
  return `${appConfig.tonVoteUrl}${path}${appConfig.tonVoteQueryParams}`;
}

export function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
  return array.reduce(
    (result, item) => {
      const keyValue = String(item[key]);
      if (!result[keyValue]) {
        result[keyValue] = [];
      }
      result[keyValue].push(item);
      return result;
    },
    {} as Record<string, T[]>,
  );
}
