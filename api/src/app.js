import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import errorHandler from './middleware/errorHandler.js';
import authRouter from './routes/auth.js';
import boardsRouter from './routes/boards.js';
import columnsRouter from './routes/columns.js';
import cardsRouter from './routes/cards.js';
import subtasksRouter from './routes/subtasks.js';
import labelsRouter from './routes/labels.js';

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:3000' }));
app.use(express.json());

app.use('/auth', authRouter);
app.use('/boards', boardsRouter);
app.use('/columns', columnsRouter);
app.use('/cards', cardsRouter);
app.use('/', subtasksRouter);
app.use('/labels', labelsRouter);

app.use(errorHandler);

export default app;
