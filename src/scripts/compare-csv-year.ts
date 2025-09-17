import * as chalk from 'chalk';
import { execSync } from 'child_process';
import * as Table from 'cli-table3';
import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';

// Define the output directory
const OUTPUT_DIR = 'exports/comparisons';

// Define the months in English
const MONTHS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];

/**
 * Find the most recent CSV file for a given month and format
 */
function findMostRecentCsvFile(baseDir: string, month: string, format: string): string | null {
  try {
    const monthDir = path.join(baseDir, month);

    // Check if the month directory exists
    if (!fs.existsSync(monthDir)) {
      return null;
    }

    // Get all date directories (e.g., "05.08")
    const dateDirs = fs
      .readdirSync(monthDir)
      .filter(dir => !dir.startsWith('.')) // Skip hidden files like .DS_Store
      .filter(dir => fs.statSync(path.join(monthDir, dir)).isDirectory())
      .sort(); // Sort by date (assuming format is consistent)

    if (dateDirs.length === 0) {
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
      return null;
    }

    // Get the most recent time directory
    const mostRecentTimeDir = timeDirs[timeDirs.length - 1];
    const timeDir = path.join(dateDir, mostRecentTimeDir);

    // Check if the CSV file with the specified format exists
    const csvFileName = `${month}-${mostRecentTimeDir}_${format}.csv`;
    const csvFilePath = path.join(timeDir, csvFileName);

    if (!fs.existsSync(csvFilePath)) {
      return null;
    }

    return csvFilePath;
  } catch (error) {
    console.error(chalk.default.red(`Error finding CSV file: ${error}`));
    return null;
  }
}

/**
 * Get all available months for a given year
 */
function getAvailableMonths(year: string, format: string): string[] {
  const baseDir = path.join('exports', year);
  const baseDirNew = path.join('exports', `${year}_NEW`);

  // Check if the base directories exist
  if (!fs.existsSync(baseDir) || !fs.existsSync(baseDirNew)) {
    console.error(chalk.default.red(`Base directories not found for year ${year}`));
    return [];
  }

  // Get all month directories in both base directories
  const monthsInBaseDir = fs
    .readdirSync(baseDir)
    .filter(dir => !dir.startsWith('.')) // Skip hidden files
    .filter(dir => fs.statSync(path.join(baseDir, dir)).isDirectory())
    .filter(dir => MONTHS.includes(dir.toLowerCase())); // Only include valid month names

  const monthsInBaseDirNew = fs
    .readdirSync(baseDirNew)
    .filter(dir => !dir.startsWith('.')) // Skip hidden files
    .filter(dir => fs.statSync(path.join(baseDirNew, dir)).isDirectory())
    .filter(dir => MONTHS.includes(dir.toLowerCase())); // Only include valid month names

  return monthsInBaseDir.filter(month => {
    if (!monthsInBaseDirNew.includes(month)) {
      return false;
    }

    // Check if CSV files exist for this month
    const file1 = findMostRecentCsvFile(baseDir, month, format);
    const file2 = findMostRecentCsvFile(baseDirNew, month, format);

    return file1 !== null && file2 !== null;
  });
}

/**
 * Compare CSV files for a given month and format, and return the output
 */
function compareCSVMonth(
  year: string,
  month: string,
  format: string
): { output: string; differences: any } {
  const baseDir = path.join('exports', year);
  const baseDirNew = path.join('exports', `${year}_NEW`);

  // Find the most recent CSV files
  const file1 = findMostRecentCsvFile(baseDir, month, format);
  const file2 = findMostRecentCsvFile(baseDirNew, month, format);

  if (!file1 || !file2) {
    return {
      output: `Failed to find CSV files for comparison for ${month}.`,
      differences: { count: 0, silaeIds: [], details: [] },
    };
  }

  // Build the compare-csv command with output to a temporary file
  const tempOutputFile = path.join('exports', 'temp_output.txt');
  const command = `bun run compare-csv -1 "${file1}" -2 "${file2}" > ${tempOutputFile}`;

  try {
    // Execute the compare-csv command
    execSync(command, { stdio: 'ignore' });

    // Read the output from the temporary file
    const output = fs.readFileSync(tempOutputFile, 'utf8');

    // Parse the output to extract the differences
    const differences = parseComparisonOutput(output);

    // Delete the temporary file
    fs.unlinkSync(tempOutputFile);

    return { output, differences };
  } catch (error) {
    console.error(chalk.default.red(`Error executing compare-csv command: ${error}`));

    // Try to delete the temporary file if it exists
    if (fs.existsSync(tempOutputFile)) {
      fs.unlinkSync(tempOutputFile);
    }

    return {
      output: `Error executing compare-csv command: ${error}`,
      differences: { count: 0, silaeIds: [], details: [] },
    };
  }
}

/**
 * Parse the comparison output to extract the differences
 */
function parseComparisonOutput(output: string): {
  count: number;
  silaeIds: string[];
  details: any[];
} {
  // Extract the number of differences
  const diffCountMatch = output.match(/Rows with differences: (\d+)/);
  const count = diffCountMatch ? parseInt(diffCountMatch[1], 10) : 0;

  // Extract the Silae IDs with differences
  const silaeIdsMatch = output.match(/Silae Ids with differences: (.*)/);
  const silaeIdsString = silaeIdsMatch ? silaeIdsMatch[1] : '';
  const silaeIds = silaeIdsString.split(', ').filter(id => id.trim() !== '');

  // Extract the details of each difference
  const details: any[] = [];
  const diffRegex = /Difference #\d+ - Silae Id: (\d+)([\s\S]*?)(?=Difference #\d+|$)/g;
  let match;

  while ((match = diffRegex.exec(output)) !== null) {
    const silaeId = match[1];
    const diffDetails = match[2];

    // Extract the table of differences
    const tableLines = diffDetails.split('\n').filter(line => line.trim() !== '');
    const tableData: { column: string; oldValue: string; newValue: string }[] = [];

    // Skip the table header and parse each row
    for (let i = 2; i < tableLines.length; i++) {
      const line = tableLines[i];
      if (line.includes('│')) {
        const parts = line.split('│').filter(part => part.trim() !== '');
        if (parts.length >= 3) {
          tableData.push({
            column: parts[0].trim(),
            oldValue: parts[1].trim(),
            newValue: parts[2].trim(),
          });
        }
      }
    }

    details.push({
      silaeId,
      differences: tableData,
    });
  }

  return { count, silaeIds, details };
}

/**
 * Format the output according to the specified template
 */
function formatOutput(year: string, monthsData: { month: string; differences: any }[]): string {
  let output = `${year}\n`;
  output += '-----------------------------------------------------\n';

  monthsData.forEach((monthData, index) => {
    const { month, differences } = monthData;

    // Capitalize the first letter of the month
    const formattedMonth = month.charAt(0).toUpperCase() + month.slice(1);

    output += `${formattedMonth}\n`;
    output += `${differences.count} différences\n`;
    output += `SilaeIDs: ${differences.silaeIds.join(', ')}\n\n`;

    // Add details for each difference
    differences.details.forEach(detail => {
      output += `${detail.silaeId}:\n`;

      // Create a table for the differences
      const table = new Table.default({
        head: ['Column', 'Old Value', 'New Value'],
        style: { head: ['cyan'] },
      });

      detail.differences.forEach(diff => {
        table.push([diff.column, diff.oldValue, diff.newValue]);
      });

      output += table.toString() + '\n\n';
    });

    // Add separator between months (except for the last month)
    if (index < monthsData.length - 1) {
      output += '____________\n\n';
    }
  });

  return output;
}

/**
 * Save the output to a file
 */
function saveOutputToFile(year: string, output: string): string {
  // Create the output directory if it doesn't exist
  const yearDir = path.join(OUTPUT_DIR, year);
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR);
  }
  if (!fs.existsSync(yearDir)) {
    fs.mkdirSync(yearDir);
  }

  // Create a filename with the current date and time
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now
    .getDate()
    .toString()
    .padStart(2, '0')}`;
  const timeStr = `${now.getHours().toString().padStart(2, '0')}-${now
    .getMinutes()
    .toString()
    .padStart(2, '0')}`;
  const filename = `comparison_${dateStr}_${timeStr}.txt`;

  // Save the output to the file
  const filePath = path.join(yearDir, filename);
  fs.writeFileSync(filePath, output);

  return filePath;
}

/**
 * Main function to compare CSV files for all months in a year
 */
function compareCSVYear(year: string, format: string): void {
  console.log(chalk.default.cyan(`Comparing ${format} CSV files for year ${year}...`));

  // Get all available months for the year
  const availableMonths = getAvailableMonths(year, format);

  if (availableMonths.length === 0) {
    console.error(chalk.default.red(`No months available for comparison for year ${year}`));
    process.exit(1);
  }

  console.log(
    chalk.default.yellow(
      `Found ${availableMonths.length} months for comparison: ${availableMonths.join(', ')}`
    )
  );

  // Compare CSV files for each month
  const monthsData: { month: string; differences: any }[] = [];

  availableMonths.forEach(month => {
    console.log(chalk.default.cyan(`Comparing ${format} CSV files for ${month}...`));

    const { differences } = compareCSVMonth(year, month, format);
    monthsData.push({ month, differences });
  });

  // Format the output
  const formattedOutput = formatOutput(year, monthsData);

  // Save the output to a file
  const outputFile = saveOutputToFile(year, formattedOutput);

  console.log(chalk.default.green(`Comparison complete. Output saved to ${outputFile}`));
}

/**
 * Command line interface
 */
const program = new Command();

program
  .name('compare-csv-year')
  .description('Compare CSV files for all months in a year')
  .version('1.0.0')
  .requiredOption('-y, --year <year>', 'Year (e.g., 2024)')
  .requiredOption('-t, --type <type>', 'CSV format type (silae, full, total, weekly)')
  .parse(process.argv);

const options = program.opts();

// Main execution
compareCSVYear(options.year, options.type.toLowerCase());
