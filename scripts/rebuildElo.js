import mysql from 'mysql2/promise';
import 'dotenv/config';
import { updateElo, PLAYERS } from '../eloEngine.js';

const pool = await mysql.createPool(process.env.MYSQL_URL);

/* start from a blank slate */
await pool.query('TRUNCATE TABLE racing.elo');

let snapshot = {};   // empty → defaults handled by updateElo

/* replay every race in chronological order */
const [races] = await pool.query('SELECT * FROM racing.races ORDER BY raced_at');
for (const race of races) {
  const pos = {};
  PLAYERS.forEach(p => (pos[p] = race[p] || null));

  snapshot = updateElo(snapshot, pos);

  /* persist snapshot aligned with the race timestamp */
  await pool.execute(
    `INSERT INTO racing.elo (${PLAYERS.join(', ')}, recorded_at)
     VALUES (${PLAYERS.map(() => '?').join(', ')}, ?)`,
    [...PLAYERS.map(p => snapshot[p]), race.raced_at]
  );
}

console.log(`✅ rebuilt elo from ${races.length} races`);
process.exit();
