import { TrueSkill, Rating } from 'ts-trueskill';

/* ─── static config ─── */
export const PLAYERS = [
  'Brennan', 'Steven', 'Jordan', 'Curtis', 'Liam', 'Shaun', 'Christy'
];

const CPU_TOP   = 1000;
const CPU_STEP  = 25;
const CPU_SIGMA = 0.1;

const BASE_MU    = 900;
const BASE_SIGMA = 200;

/* more volatile environment */
const env = new TrueSkill(
  BASE_MU,
  BASE_SIGMA,
  BASE_SIGMA / 8,      // beta ↓  → swings ↑
  BASE_SIGMA / 150     // tau  ↑  → volatility ↑
);

/* σ dynamics */
const NO_SHOW_INFLATION = 2;
const SURPRISE_FACTOR   = 5;
const SHRINK_FACTOR     = 0.9;

/* weighting & upset factors */
const CPU_COMPARISON_FACTOR   = 0.8;   // CPUs count 20 %
const HUMAN_COMPARISON_FACTOR = 1.5;   // humans count 100 % (increase to >1 to up-weight)
const UPSET_MU_PENALTY_FACTOR = 0.25;  // 25 % of μ gap
const UPSET_SIGMA_FACTOR      = 0.10;  // 10 % of μ gap → σ

/* helpers */
const parsed = v => (typeof v === 'string' ? JSON.parse(v) : v);
const asJSON = v => (typeof v === 'string' ? v : JSON.stringify(v));

/**
 * Compute the next Elo snapshot from one race result.
 * @param {Object<string,string>} latest    player → JSON({mu,sigma})
 * @param {Object<string,number>} positions player → finishing place (1-12)
 * @returns {Object<string,string>} next snapshot
 */
export function updateElo (latest = {}, positions = {}) {
  /* build lineup (humans + substitute CPUs) */
  const lineup = Array(12).fill(null);
  PLAYERS.forEach(p => {
    const r = +positions[p];
    if (r >= 1 && r <= 12) lineup[r - 1] = p;
  });
  let cpuIdx = 0;
  for (let i = 0; i < 12; i++) {
    if (!lineup[i]) {
      lineup[i] = { cpu: true, rating: new Rating(CPU_TOP - CPU_STEP * cpuIdx++, CPU_SIGMA) };
    }
  }

  /* stash pre-race stats */
  const prevStats = {};
  PLAYERS.forEach(p => {
    prevStats[p] = latest[p] ? parsed(latest[p]) : { mu: BASE_MU, sigma: BASE_SIGMA };
  });

  /* rate via TrueSkill */
  const teams = lineup.map(e =>
    typeof e === 'string'
      ? [new Rating(prevStats[e].mu, prevStats[e].sigma)]
      : [e.rating]
  );
  const newTeams = env.rate(teams, teams.map((_, i) => i));

  /* carry-forward */
  const snap = {};
  PLAYERS.forEach(p => {
    snap[p] = asJSON(prevStats[p]);
  });

  /* baseline μ update with both human & CPU weighting */
  newTeams.forEach((team, i) => {
    const id = lineup[i];
    if (typeof id !== 'string') return;

    const prev  = prevStats[id];
    const rawMu = team[0].mu;
    const delta = rawMu - prev.mu;

    let humanOpp = 0, cpuOpp = 0;
    lineup.forEach((opp, j) => {
      if (j === i) return;
      typeof opp === 'string' ? humanOpp++ : cpuOpp++;
    });
    const totalOpp = humanOpp + cpuOpp;
    const weight   = totalOpp
      ? (humanOpp * HUMAN_COMPARISON_FACTOR + cpuOpp * CPU_COMPARISON_FACTOR) / totalOpp
      : 1;

    snap[id] = JSON.stringify({ mu: prev.mu + delta * weight, sigma: team[0].sigma });
  });

  /* upset adjustment (human vs human) */
  for (let a = 0; a < PLAYERS.length; a++) {
    const pA = PLAYERS[a], posA = positions[pA];
    if (!posA) continue;

    for (let b = a + 1; b < PLAYERS.length; b++) {
      const pB = PLAYERS[b], posB = positions[pB];
      if (!posB) continue;

      if (posA > posB && prevStats[pA].mu > prevStats[pB].mu) {
        applyUpset(pA, pB, prevStats[pA].mu - prevStats[pB].mu);
      } else if (posB > posA && prevStats[pB].mu > prevStats[pA].mu) {
        applyUpset(pB, pA, prevStats[pB].mu - prevStats[pA].mu);
      }
    }
  }

  function applyUpset(loser, winner, gap) {
    const L = parsed(snap[loser]);
    const W = parsed(snap[winner]);
    const shift = gap * UPSET_MU_PENALTY_FACTOR;
    L.mu -= shift;
    W.mu += shift;
    L.sigma = Math.min(BASE_SIGMA, L.sigma + gap * UPSET_SIGMA_FACTOR);
    W.sigma = Math.min(BASE_SIGMA, W.sigma + gap * UPSET_SIGMA_FACTOR * 0.5);
    snap[loser]  = JSON.stringify(L);
    snap[winner] = JSON.stringify(W);
  }

  /* σ dynamics */
  PLAYERS.forEach(p => {
    const prev  = prevStats[p];
    const curr  = parsed(snap[p]);
    const raced = positions[p] != null;

    if (!raced) {
      curr.sigma = Math.min(BASE_SIGMA, curr.sigma + NO_SHOW_INFLATION);
    } else {
      const deltaMu      = Math.abs(curr.mu - prev.mu);
      const surpriseBump = Math.max(0, deltaMu - prev.sigma) / prev.sigma * SURPRISE_FACTOR;
      curr.sigma = surpriseBump > 0
        ? Math.min(BASE_SIGMA, curr.sigma + surpriseBump)
        : Math.max(0.1, curr.sigma * SHRINK_FACTOR);
    }
    snap[p] = JSON.stringify(curr);
  });

  return snap;
}
