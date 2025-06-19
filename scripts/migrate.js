import mysql from 'mysql2/promise';
import 'dotenv/config';

const pool = await mysql.createPool(process.env.MYSQL_URL);
await pool.query(`CREATE DATABASE IF NOT EXISTS racing`);
await pool.query(`USE racing`);

await pool.query(`
CREATE TABLE IF NOT EXISTS races (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  track     VARCHAR(50) NOT NULL,
  Brennan   TINYINT UNSIGNED,
  Steven    TINYINT UNSIGNED,
  Jordan    TINYINT UNSIGNED,
  Curtis    TINYINT UNSIGNED,
  Liam      TINYINT UNSIGNED,
  Shaun     TINYINT UNSIGNED,
  Christy   TINYINT UNSIGNED,
  raced_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB`);

await pool.query(`
CREATE TABLE IF NOT EXISTS elo (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  Brennan     JSON NOT NULL,
  Steven      JSON NOT NULL,
  Jordan      JSON NOT NULL,
  Curtis      JSON NOT NULL,
  Liam        JSON NOT NULL,
  Shaun       JSON NOT NULL,
  Christy     JSON NOT NULL,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB`);

console.log('Schema ready'); process.exit();
