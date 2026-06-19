require('dotenv').config();
const express = require('express');
const cors = require('cors');
const errorHandler = require('./middleware/errorHandler');
const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:3000' }));
app.use(express.json());

app.use('/auth', require('./routes/auth'));
app.use('/boards', require('./routes/boards'));
app.use('/columns', require('./routes/columns'));
app.use('/cards', require('./routes/cards'));
app.use('/', require('./routes/subtasks'));
app.use('/labels', require('./routes/labels'));

app.use(errorHandler);

module.exports = app;
