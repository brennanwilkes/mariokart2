import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import 'dotenv/config';
import { updateElo, PLAYERS } from './eloEngine.js';

/*────────── fixed colors — order mirrors PLAYERS ──────────*/
const COLORS = [
  '#e6194B', // Brennan
  '#3cb44b', // Steven
  '#4363d8', // Jordan
  '#f58231', // Curtis
  '#911eb4', // Liam
  '#46f0f0', // Shaun
  '#f032e6'  // Christy
];

const parsed = v => (typeof v === 'string' ? JSON.parse(v) : v);

/* db & app bootstrap */
const pool      = await mysql.createPool(process.env.MYSQL_URL);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app       = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

/*─────────────── POST /race ───────────────*/
app.post('/race', async (req, res) => {
  const { track, ...posRaw } = req.body;

  /* save raw race */
  await pool.execute(
    `INSERT INTO racing.races (track, ${PLAYERS.join(', ')})
     VALUES (?, ${PLAYERS.map(() => '?').join(', ')})`,
    [track, ...PLAYERS.map(p => posRaw[p] || null)]
  );

  /* latest Elo snapshot */
  const [rows] = await pool.query(
    'SELECT * FROM racing.elo ORDER BY recorded_at DESC LIMIT 1'
  );
  const latestRow = rows[0] || {};
  const latest    = {};
  PLAYERS.forEach(p => { if (latestRow[p]) latest[p] = parsed(latestRow[p]); });

  /* cast positions to numbers/null */
  const pos = {};
  PLAYERS.forEach(p => {
    const v = Number(posRaw[p]);
    pos[p] = isNaN(v) ? null : v;
  });

  /* compute next snapshot */
  const snap = updateElo(latest, pos);

  /* persist elo snapshot */
  await pool.execute(
    `INSERT INTO racing.elo (${PLAYERS.join(', ')})
     VALUES (${PLAYERS.map(() => '?').join(', ')})`,
    PLAYERS.map(p => snap[p])
  );

  res.redirect('/');
});

/*─────────────── GET /api/elo ───────────────*/
app.get('/api/elo', async (_, res) => {
  const [eloRows]  = await pool.query(
    'SELECT * FROM racing.elo ORDER BY recorded_at'
  );
  const [raceRows] = await pool.query(
    'SELECT * FROM racing.races ORDER BY raced_at'
  );                               // one race per elo snapshot

  res.json({
    labels: eloRows.map(r => r.recorded_at),
    datasets: PLAYERS.map((p, i) => ({
      label : p,
      color : COLORS[i],
      mu    : eloRows.map(r => parsed(r[p]).mu),
      sigma : eloRows.map(r => parsed(r[p]).sigma),
      pos   : raceRows.map(r => (r[p] === null ? null : Number(r[p])))
    }))
  });
});

/* static page */
app.get('/elo', (_, res) =>
  res.sendFile(path.join(__dirname, 'public', 'elo.html'))
);

/* start server */
app.listen(process.env.PORT || 3000, () =>
  console.log('🏎️  Server ready on :3000')
);
