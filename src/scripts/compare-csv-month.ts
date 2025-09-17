import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import * as chalk from 'chalk';

// Define the base directories
const BASE_DIR_2025 = 'exports/2025';
const BASE_DIR_2025_NEW = 'exports/2025_NEW';

/**
 * Find the most recent CSV file for a given month and format
 */
function findMostRecentCsvFile(baseDir: string, month: string, format: string): string | null {
  try {
    const monthDir = path.join(baseDir, month);

    // Check if the month directory exists
    if (!fs.existsSync(monthDir)) {
      console.error(chalk.default.red(`Directory not found: ${monthDir}`));
      return null;
    }

    // Get all date directories (e.g., "05.08")
    const dateDirs = fs
      .readdirSync(monthDir)
      .filter(dir => !dir.startsWith('.')) // Skip hidden files like .DS_Store
      .filter(dir => fs.statSync(path.join(monthDir, dir)).isDirectory())
      .sort(); // Sort by date (assuming format is consistent)

    if (dateDirs.length === 0) {
      console.error(chalk.default.red(`No date directories found in ${monthDir}`));
      return null;
    }

    // Get the most recent date directory
    const mostRecentDateDir = dateDirs[dateDirs.length - 1];
    const dateDir = path.join(monthDir, mostRecentDateDir);

    // Get all time directories (e.g., "14:29")
    const timeDirs = fs
      .readdirSync(dateDir)
      .filter(dir => !dir.startsWith('.')) // Skip hidden files
      .filter(dir => fs.statSync(path.join(dateDir, dir)).isDirectory())
      .sort(); // Sort by time (assuming format is consistent)

    if (timeDirs.length === 0) {
      console.error(chalk.default.red(`No time directories found in ${dateDir}`));
      return null;
    }

    // Get the most recent time directory
    const mostRecentTimeDir = timeDirs[timeDirs.length - 1];
    const timeDir = path.join(dateDir, mostRecentTimeDir);

    // Check if the CSV file with the specified format exists
    const csvFileName = `${month}-${mostRecentTimeDir}_${format}.csv`;
    const csvFilePath = path.join(timeDir, csvFileName);

    if (!fs.existsSync(csvFilePath)) {
      console.error(chalk.default.red(`CSV file not found: ${csvFilePath}`));
      return null;
    }

    return csvFilePath;
  } catch (error) {
    console.error(chalk.default.red(`Error finding CSV file: ${error}`));
    return null;
  }
}

/**
 * Main function to compare CSV files for a given month and format
 */
function compareCSVMonth(month: string, format: string): void {
  console.log(chalk.default.cyan(`Comparing ${format} CSV files for ${month}...`));

  // Find the most recent CSV files
  const file1 = findMostRecentCsvFile(BASE_DIR_2025, month, format);
  const file2 = findMostRecentCsvFile(BASE_DIR_2025_NEW, month, format);

  if (!file1 || !file2) {
    console.error(chalk.default.red('Failed to find CSV files for comparison.'));
    process.exit(1);
  }

  console.log(chalk.default.yellow(`Found files for comparison:`));
  console.log(`File 1: ${file1}`);
  console.log(`File 2: ${file2}`);

  // Build the compare-csv command
  const command = `bun run compare-csv -1 "${file1}" -2 "${file2}"`;

  console.log(chalk.default.cyan(`Executing command: ${command}`));

  try {
    // Execute the compare-csv command
    execSync(command, { stdio: 'inherit' });
  } catch (error) {
    console.error(chalk.default.red(`Error executing compare-csv command: ${error}`));
    process.exit(1);
  }
}

/**
 * Command line interface
 */
const program = new Command();

program
  .name('compare-csv-month')
  .description('Compare the most recent CSV files for a given month and format')
  .version('1.0.0')
  .requiredOption('-m, --month <month>', 'Month name in English (e.g., april)')
  .requiredOption('-t, --type <type>', 'CSV format type (silae, full, total, weekly)')
  .parse(process.argv);

const options = program.opts();

// Main execution
compareCSVMonth(options.month.toLowerCase(), options.type.toLowerCase());
