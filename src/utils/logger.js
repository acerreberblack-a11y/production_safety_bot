import winston from 'winston';

// Настройка логгера для вывода информации в файлы и консоль
const logger = winston.createLogger({
  level: 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
  ),
  transports: [
    new winston.transports.File({
      filename: 'error.log',
      level: 'error',
      encoding: 'utf-8', // Указываем кодировку
    }),
    new winston.transports.File({
      filename: 'combined.log',
      encoding: 'utf-8', // Указываем кодировку
    }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple(),
    encoding: 'utf-8', // Указываем кодировку для консоли
  }));
}

export default logger;
