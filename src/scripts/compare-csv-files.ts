// Standard imports
import * as chalk from 'chalk';
import * as Table from 'cli-table3';
import { Command } from 'commander';
import { parse } from 'fast-csv';
import { pipe } from 'fp-ts/function';
import * as TE from 'fp-ts/TaskEither';
import fs from 'fs';
import { List, Map } from 'immutable';
import path from 'path';

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
 * Returns a map of keys to arrays of rows
 */
const groupRowsByKey = (rows: CsvRow[], keyColumns: string[]): Map<string, CsvRow[]> => {
  return List(rows).reduce((acc, row) => {
    const key = keyColumns.map(col => row[col] || '').join('|');
    const existingRows = acc.get(key) || [];
    return acc.set(key, [...existingRows, row]);
  }, Map<string, CsvRow[]>());
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
  // If no key columns are specified, use all columns for comparison
  // but still use "Silae Id" as the display key if it exists
  const comparisonKeyColumns =
    keyColumns.length > 0
      ? keyColumns
      : file1Rows.length > 0 && file1Rows[0]['Silae Id'] !== undefined
      ? ['Silae Id']
      : file1Rows.length > 0
      ? [Object.keys(file1Rows[0])[0]]
      : [];

  const file1Map = groupRowsByKey(file1Rows, comparisonKeyColumns);
  const file2Map = groupRowsByKey(file2Rows, comparisonKeyColumns);

  const allKeys = new Set([...file1Map.keys(), ...file2Map.keys()]);

  const file1Only: CsvRow[] = [];
  const file2Only: CsvRow[] = [];
  const differences: DiffResult['differences'] = [];

  allKeys.forEach(key => {
    const rows1 = file1Map.get(key) || [];
    const rows2 = file2Map.get(key) || [];

    if (rows1.length === 0) {
      // All rows with this key are only in file 2
      rows2.forEach(row2 => file2Only.push(row2));
    } else if (rows2.length === 0) {
      // All rows with this key are only in file 1
      rows1.forEach(row1 => file1Only.push(row1));
    } else {
      // Both files have rows with this key

      // First, check if the number of rows is different
      if (rows1.length !== rows2.length) {
        // Different number of rows for this key - this is a difference
        // Add a special difference entry for this
        const row1 = rows1[0]; // Use the first row for display
        const row2 = rows2[0]; // Use the first row for display

        differences.push({
          key,
          row1,
          row2,
          diffColumns: [
            {
              column: 'Number of entries',
              value1: rows1.length.toString(),
              value2: rows2.length.toString(),
            },
          ],
        });
      }

      // Then compare each row in file1 with each row in file2
      // This is a simple approach that might not be perfect for all cases
      // but should catch most differences
      for (let i = 0; i < Math.min(rows1.length, rows2.length); i++) {
        const row1 = rows1[i];
        const row2 = rows2[i];

        // Get all columns from both rows
        const allColumns = new Set([...Object.keys(row1), ...Object.keys(row2)]);
        const diffColumns: Array<{ column: string; value1: string; value2: string }> = [];

        allColumns.forEach(column => {
          // Skip key columns and ignored columns only if key columns were explicitly specified
          if (
            (keyColumns.length > 0 && keyColumns.includes(column)) ||
            ignoreColumns.includes(column)
          ) {
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

      // If there are more rows in file1 than file2, add the extras to file1Only
      if (rows1.length > rows2.length) {
        for (let i = rows2.length; i < rows1.length; i++) {
          file1Only.push(rows1[i]);
        }
      }

      // If there are more rows in file2 than file1, add the extras to file2Only
      if (rows2.length > rows1.length) {
        for (let i = rows1.length; i < rows2.length; i++) {
          file2Only.push(rows2[i]);
        }
      }
    }
  });

  // Always use "Silae Id" as the display key if it exists
  const displayKey =
    file1Rows.length > 0 && file1Rows[0]['Silae Id'] !== undefined
      ? 'Silae Id'
      : comparisonKeyColumns.join('+');

  return { key: displayKey, file1Only, file2Only, differences };
};

/**
 * Format and display the diff results in a visually appealing way
 */
/**
 * Extract month and year from file path
 */
const extractMonthAndYear = (filePath: string): { month: string; year: string } => {
  // Expected path format: exports/2025/april/05.08/14:32/april-14:32_full.csv
  // or: exports/2025_NEW/april/05.08/14:29/april-14:29_full.csv
  const parts = filePath.split('/');

  // Find the year part (should contain 4 digits)
  const yearPart = parts.find(part => /\d{4}/.test(part));
  const year = yearPart ? yearPart.match(/\d{4}/)?.[0] || '' : '';

  // Month should be the part after the year
  const yearIndex = parts.findIndex(part => part === yearPart);
  const month = yearIndex >= 0 && yearIndex + 1 < parts.length ? parts[yearIndex + 1] : '';

  return { month, year };
};

/**
 * Determine if a file is "New" or "Old" based on its path
 */
const getFileType = (filePath: string): string => {
  return filePath.includes('_NEW') ? 'New' : 'Old';
};

const displayDiffResults = (
  result: DiffResult,
  file1Path: string,
  file2Path: string,
  options: {
    showSummaryOnly?: boolean;
    outputFormat?: 'console' | 'html';
    onlyDiffs?: boolean;
  } = {}
): void => {
  const file1Name = path.basename(file1Path);
  const file2Name = path.basename(file2Path);

  // Extract month and year from file paths
  const file1Info = extractMonthAndYear(file1Path);
  const file2Info = extractMonthAndYear(file2Path);

  // Use the month and year from the first file (they should be the same)
  const month = file1Info.month || file2Info.month || 'Unknown';
  const year = file1Info.year || file2Info.year || 'Unknown';

  // Determine file types
  const file1Type = getFileType(file1Path);
  const file2Type = getFileType(file2Path);

  console.log(chalk.default.bold('\n=== CSV Comparison Results ==='));
  console.log(
    chalk.default.cyan(`Month: ${month.charAt(0).toUpperCase() + month.slice(1)}, Year: ${year}`)
  );
  console.log(`Comparing files using key: ${chalk.default.cyan(result.key)}`);
  console.log(`File 1: ${chalk.default.yellow(file1Type)}`);
  console.log(`File 2: ${chalk.default.yellow(file2Type)}`);

  if (!options.onlyDiffs) {
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
  }

  if (options.showSummaryOnly) {
    return;
  }

  // Display rows only in file 1
  if (!options.onlyDiffs && result.file1Only.length > 0) {
    console.log(chalk.default.bold(`\nRows only in ${file1Type} (${result.file1Only.length}):`));

    result.file1Only.forEach((row, index) => {
      // Use Silae Id if available, otherwise use the first column
      const displayId = row['Silae Id'] || Object.values(row)[0] || 'N/A';
      console.log(chalk.default.bold(`\nRow #${index + 1} - Silae Id: ${displayId}`));

      const table = new Table.default({
        head: ['Column', 'Value'],
        style: { head: ['cyan'] },
      });

      // Add each column and its value to the table
      Object.entries(row).forEach(([column, value]) => {
        table.push([column, value]);
      });

      console.log(table.toString());
    });
  }

  // Display rows only in file 2
  if (!options.onlyDiffs && result.file2Only.length > 0) {
    console.log(chalk.default.bold(`\nRows only in ${file2Type} (${result.file2Only.length}):`));

    result.file2Only.forEach((row, index) => {
      // Use Silae Id if available, otherwise use the first column
      const displayId = row['Silae Id'] || Object.values(row)[0] || 'N/A';
      console.log(chalk.default.bold(`\nRow #${index + 1} - Silae Id: ${displayId}`));

      const table = new Table.default({
        head: ['Column', 'Value'],
        style: { head: ['cyan'] },
      });

      // Add each column and its value to the table
      Object.entries(row).forEach(([column, value]) => {
        table.push([column, value]);
      });

      console.log(table.toString());
    });
  }

  // Display differences
  if (result.differences.length > 0) {
    console.log(chalk.default.bold(`\nRows with differences (${result.differences.length}):`));

    result.differences.forEach((diff, index) => {
      // Use Silae Id if available, otherwise use the original key
      const displayId = diff.row1['Silae Id'] || diff.key;
      console.log(chalk.default.bold(`\nDifference #${index + 1} - Silae Id: ${displayId}`));

      const table = new Table.default({
        head: ['Column', `${file1Type} Value`, `${file2Type} Value`],
        style: { head: ['cyan'] },
      });

      diff.diffColumns.forEach(({ column, value1, value2 }) => {
        table.push([column, chalk.default.red(value1), chalk.default.green(value2)]);
      });

      console.log(table.toString());
    });
  }

  // Display only Silae Ids with differences
  if (result.differences.length > 0) {
    console.log(
      chalk.default.yellow(
        `Silae Ids with differences: ${result.differences
          .sort((a, b) => {
            const idA = a.row1['Silae Id'] || a.key;
            const idB = b.row1['Silae Id'] || b.key;
            return idA.localeCompare(idB);
          })
          .map(d => d.row1['Silae Id'] || d.key)
          .join(', ')}`
      )
    );
  }
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
    onlyDiffs?: boolean;
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
        onlyDiffs: options.onlyDiffs,
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
  .option(
    '-k, --key-columns <columns>',
    'Comma-separated list of columns to use as keys (if not specified, all columns will be compared)',
    val => val.split(',')
  )
  .option(
    '-i, --ignore-columns <columns>',
    'Comma-separated list of columns to ignore in comparison',
    val => val.split(',')
  )
  .option('-s, --summary-only', 'Show only summary statistics', false)
  .option('-f, --format <format>', 'Output format (console or html)', 'console')
  .option('--only-diffs', 'Display only differing rows (skip summary and unique rows)', true)
  .parse(process.argv);

const options = program.opts();

// Main execution
const main = async () => {
  try {
    await pipe(
      compareCSVFiles(options.file1, options.file2, {
        keyColumns: options.keyColumns || [],
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
