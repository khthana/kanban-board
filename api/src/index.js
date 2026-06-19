import 'dotenv/config';
import app from './app.js';

if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET env var is required');
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL env var is required');

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API listening on :${PORT}`));
