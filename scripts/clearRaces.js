import mysql from 'mysql2/promise';
import 'dotenv/config';

const pool = await mysql.createPool(process.env.MYSQL_URL);
await pool.query('TRUNCATE TABLE racing.races');
console.log('✅ races table cleared');
process.exit();
