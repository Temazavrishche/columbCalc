import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new DailyRotateFile({
            filename: 'logs/%DATE%-error.log',
            level: 'error',
            datePattern: 'YYYY-MM-DD',
            maxSize: '20m',  // Максимальный размер файла лога
            maxFiles: '14d', // Хранить файлы логов за последние 14 дней
        }),
        new DailyRotateFile({
            filename: 'logs/%DATE%-combined.log',
            datePattern: 'YYYY-MM-DD',
            maxSize: '20m',
            maxFiles: '14d',
        })
    ],
});

export default logger;
