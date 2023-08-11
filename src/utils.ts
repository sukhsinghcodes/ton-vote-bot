export function convertArrayTo2dArray<T>(array: T[], columns: number): T[][] {
  const rows = Math.ceil(array.length / columns);

  const resultArray: T[][] = [];

  for (let i = 0; i < rows; i++) {
    const row = array.slice(i * columns, (i + 1) * columns);
    resultArray.push(row);
  }
  return resultArray;
}
