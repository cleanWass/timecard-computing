import { DateTimeFormatter, LocalDate, LocalTime } from '@js-joda/core';
import { format } from 'fast-csv';
import fs from 'fs';
import { LocalDateRange } from '../../domain/models/local-date-range';
import { FullHeaders, SilaeHeaders, TotalHeaders } from './headers';

export const prepareEnv = ({
  period,
  debug = false,
  displayLog = true,
  persistence = 'logs',
}: {
  persistence?: 'logs' | 'rh' | 'none';
  debug: boolean;
  displayLog: boolean;
  period: LocalDateRange;
}) => {
  const year = period.end.year().toString();
  const month = period.end.month().toString().toLowerCase();
  const currentTime = LocalTime.now().format(DateTimeFormatter.ofPattern('HH:mm'));
  const currentDay = LocalDate.now().format(DateTimeFormatter.ofPattern('dd.MM'));
  const basePath = persistence === 'rh' ? `exports/rendu` : `exports/${year}/${month}/${currentDay}/${currentTime}`;

  if (debug) {
    [debug, displayLog].forEach((flag, index) => console.log(`${['debug', 'displayLog'][index]} ${flag}`));
    console.log('basePath', basePath);
  }

  if (!fs.existsSync(basePath)) {
    if (debug) console.log('create directory');
    fs.mkdirSync(basePath, { recursive: true });
    fs.writeFileSync(`${basePath}/logs`, '', 'utf8');
  }

  const logger = (message: string) => {
    fs.appendFileSync(
      `${basePath}/logs`,
      `${message}
`,
      'utf8'
    );
  };

  const fileStreams = ['silae', 'total', 'full', 'weekly'].reduce(
    (acc, type) => {
      const filename =
        persistence === 'logs' ? `${basePath}/${month}-${currentTime}_${type}.csv` : `${basePath}/${type}.csv`;
      acc[type] = fs.createWriteStream(filename);
      return acc;
    },
    {} as Record<'silae' | 'total' | 'full' | 'weekly', fs.WriteStream>
  );

  const csvStreamDebug = format({ headers: [...FullHeaders] });
  const csvStreamCompiled = format({ headers: [...TotalHeaders] });
  const csvStreamSilae = format({ headers: [...SilaeHeaders] });
  const csvStreamWeekly = format({ headers: [...TotalHeaders] });

  csvStreamDebug.pipe(fileStreams.full).on('end', () => process.exit());
  csvStreamCompiled.pipe(fileStreams.total).on('end', () => process.exit());
  csvStreamSilae.pipe(fileStreams.silae).on('end', () => process.exit());
  csvStreamWeekly.pipe(fileStreams.weekly).on('end', () => process.exit());

  return {
    cvsStream: {
      csvStreamSilae,
      csvStreamCompiled,
      csvStreamDebug,
      csvStreamWeekly,
    },
    log: {
      logger,
      total: 0,
      failed: 0,
      successful: 0,
    },
  };
};
