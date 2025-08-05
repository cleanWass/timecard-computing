import { pipe } from 'fp-ts/function';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as A from 'fp-ts/Array';
import * as O from 'fp-ts/Option';
import { List, Map } from 'immutable';
import fs from 'fs';
import path from 'path';
import { parse } from 'fast-csv';

// Standard imports
import * as chalk from 'chalk';
import * as Table from 'cli-table3';
import { Command } from 'commander';

interface CsvRow {
  [key: string]: string;
}

interface DiffResult {
  key: string;
  file1Only: CsvRow[];
  file2Only: CsvRow[];
  differences: Array<{
    key: string;
    row1: CsvRow;
    row2: CsvRow;
    diffColumns: Array<{
      column: string;
      value1: string;
      value2: string;
    }>;
  }>;
}

/**
 * Parse a CSV file and return an array of objects
 */
const parseCSV = (filePath: string): TE.TaskEither<Error, CsvRow[]> => {
  return TE.tryCatch(
    () => {
      return new Promise<CsvRow[]>((resolve, reject) => {
        const rows: CsvRow[] = [];
        fs.createReadStream(filePath)
          .pipe(parse({ headers: true }))
          .on('error', error => reject(error))
          .on('data', (row: CsvRow) => rows.push(row))
          .on('end', () => resolve(rows));
      });
    },
    error => new Error(`Error parsing CSV file ${filePath}: ${error}`)
  );
};

/**
 * Group rows by a key column (or combination of columns)
 */
const groupRowsByKey = (rows: CsvRow[], keyColumns: string[]): Map<string, CsvRow> => {
  return List(rows).reduce((acc, row) => {
    const key = keyColumns.map(col => row[col] || '').join('|');
    return acc.set(key, row);
  }, Map<string, CsvRow>());
};

/**
 * Compare two CSV files and return differences
 */
const compareCSVs = (
  file1Rows: CsvRow[],
  file2Rows: CsvRow[],
  keyColumns: string[],
  ignoreColumns: string[] = []
): DiffResult => {
  const file1Map = groupRowsByKey(file1Rows, keyColumns);
  const file2Map = groupRowsByKey(file2Rows, keyColumns);

  const allKeys = new Set([...file1Map.keys(), ...file2Map.keys()]);

  const file1Only: CsvRow[] = [];
  const file2Only: CsvRow[] = [];
  const differences: DiffResult['differences'] = [];

  allKeys.forEach(key => {
    const row1 = file1Map.get(key);
    const row2 = file2Map.get(key);

    if (!row1) {
      file2Only.push(row2!);
    } else if (!row2) {
      file1Only.push(row1);
    } else {
      // Both files have this row, check for differences
      const diffColumns: Array<{ column: string; value1: string; value2: string }> = [];

      // Get all columns from both rows
      const allColumns = new Set([...Object.keys(row1), ...Object.keys(row2)]);

      allColumns.forEach(column => {
        // Skip key columns and ignored columns
        if (keyColumns.includes(column) || ignoreColumns.includes(column)) {
          return;
        }

        const value1 = row1[column] || '';
        const value2 = row2[column] || '';

        if (value1 !== value2) {
          diffColumns.push({ column, value1, value2 });
        }
      });

      if (diffColumns.length > 0) {
        differences.push({ key, row1, row2, diffColumns });
      }
    }
  });

  return { key: keyColumns.join('+'), file1Only, file2Only, differences };
};

/**
 * Format and display the diff results in a visually appealing way
 */
const displayDiffResults = (
  result: DiffResult,
  file1Path: string,
  file2Path: string,
  options: {
    showSummaryOnly?: boolean;
    outputFormat?: 'console' | 'html';
  } = {}
): void => {
  const file1Name = path.basename(file1Path);
  const file2Name = path.basename(file2Path);

  console.log(chalk.default.bold('\n=== CSV Comparison Results ==='));
  console.log(`Comparing files using key: ${chalk.default.cyan(result.key)}`);
  console.log(`File 1: ${chalk.default.yellow(file1Path)}`);
  console.log(`File 2: ${chalk.default.yellow(file2Path)}`);

  // Summary statistics
  console.log(chalk.default.bold('\nSummary:'));
  console.log(
    `Total rows in File 1: ${chalk.default.yellow(
      result.file1Only.length + result.differences.length
    )}`
  );
  console.log(
    `Total rows in File 2: ${chalk.default.yellow(
      result.file2Only.length + result.differences.length
    )}`
  );
  console.log(`Rows only in File 1: ${chalk.default.red(result.file1Only.length)}`);
  console.log(`Rows only in File 2: ${chalk.default.green(result.file2Only.length)}`);
  console.log(`Rows with differences: ${chalk.default.yellow(result.differences.length)}`);

  if (options.showSummaryOnly) {
    return;
  }

  // Display rows only in file 1
  if (result.file1Only.length > 0) {
    console.log(chalk.default.bold(`\nRows only in ${file1Name} (${result.file1Only.length}):`));
    const table = new Table.default({
      head: ['Key', 'Data'],
      style: { head: ['cyan'] },
    });

    result.file1Only.forEach(row => {
      const key = result.key
        .split('+')
        .map(k => row[k])
        .join('|');
      table.push([key, JSON.stringify(row)]);
    });

    console.log(table.toString());
  }

  // Display rows only in file 2
  if (result.file2Only.length > 0) {
    console.log(chalk.default.bold(`\nRows only in ${file2Name} (${result.file2Only.length}):`));
    const table = new Table.default({
      head: ['Key', 'Data'],
      style: { head: ['cyan'] },
    });

    result.file2Only.forEach(row => {
      const key = result.key
        .split('+')
        .map(k => row[k])
        .join('|');
      table.push([key, JSON.stringify(row)]);
    });

    console.log(table.toString());
  }

  // Display differences
  if (result.differences.length > 0) {
    console.log(chalk.default.bold(`\nRows with differences (${result.differences.length}):`));

    result.differences.forEach((diff, index) => {
      console.log(chalk.default.bold(`\nDifference #${index + 1} - Key: ${diff.key}`));

      const table = new Table.default({
        head: ['Column', `${file1Name} Value`, `${file2Name} Value`],
        style: { head: ['cyan'] },
      });

      diff.diffColumns.forEach(({ column, value1, value2 }) => {
        table.push([column, chalk.default.red(value1), chalk.default.green(value2)]);
      });

      console.log(table.toString());
    });
  }
  console.log(
    chalk.default.yellow(
      `Key with differences: ${result.differences
        .sort((a, b) => a.key.localeCompare(b.key))
        .map(d => d.key)
        .join(', ')}`
    )
  );
};

/**
 * Main function to compare two CSV files
 */
const compareCSVFiles = (
  file1Path: string,
  file2Path: string,
  options: {
    keyColumns: string[];
    ignoreColumns?: string[];
    showSummaryOnly?: boolean;
    outputFormat?: 'console' | 'html';
  }
): TE.TaskEither<Error, void> => {
  return pipe(
    TE.Do,
    TE.bind('file1Rows', () => parseCSV(file1Path)),
    TE.bind('file2Rows', () => parseCSV(file2Path)),
    TE.map(({ file1Rows, file2Rows }) => {
      const result = compareCSVs(file1Rows, file2Rows, options.keyColumns, options.ignoreColumns);

      displayDiffResults(result, file1Path, file2Path, {
        showSummaryOnly: options.showSummaryOnly,
        outputFormat: options.outputFormat,
      });

      return undefined;
    })
  );
};

/**
 * Command line interface
 */
const program = new Command();

program
  .name('compare-csv-files')
  .description('Compare two CSV files and show differences')
  .version('1.0.0')
  .requiredOption('-1, --file1 <path>', 'Path to first CSV file')
  .requiredOption('-2, --file2 <path>', 'Path to second CSV file')
  .requiredOption(
    '-k, --key-columns <columns>',
    'Comma-separated list of columns to use as keys',
    val => val.split(',')
  )
  .option(
    '-i, --ignore-columns <columns>',
    'Comma-separated list of columns to ignore in comparison',
    val => val.split(',')
  )
  .option('-s, --summary-only', 'Show only summary statistics', false)
  .option('-f, --format <format>', 'Output format (console or html)', 'console')
  .parse(process.argv);

const options = program.opts();

// Main execution
const main = async () => {
  try {
    await pipe(
      compareCSVFiles(options.file1, options.file2, {
        keyColumns: options.keyColumns,
        ignoreColumns: options.ignoreColumns || [],
        showSummaryOnly: options.summaryOnly,
        outputFormat: options.format as 'console' | 'html',
      }),
      TE.match(
        error => {
          console.error(chalk.default.red(`Error: ${error.message}`));
          process.exit(1);
        },
        () => {
          console.log(chalk.default.green('\nComparison completed successfully.'));
        }
      )
    )();
  } catch (error) {
    console.error(chalk.default.red(`Unexpected error: ${error}`));
    process.exit(1);
  }
};

main();
