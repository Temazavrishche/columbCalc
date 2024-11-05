import winston from 'winston';

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: 'error.log', level: 'error' }), // Логи ошибок в файл
        new winston.transports.File({ filename: 'combined.log' }) // Все логи в файл
    ],
});

export default logger;
