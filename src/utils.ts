import { tonVoteQueryParams, tonVoteUrl } from './config';

export function convertArrayTo2dArray<T>(array: T[], columns: number): T[][] {
  const rows = Math.ceil(array.length / columns);

  const resultArray: T[][] = [];

  for (let i = 0; i < rows; i++) {
    const row = array.slice(i * columns, (i + 1) * columns);
    resultArray.push(row);
  }
  return resultArray;
}

export function generateWebAppUrl(path: string): string {
  return `${tonVoteUrl}${path}${tonVoteQueryParams}`;
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
