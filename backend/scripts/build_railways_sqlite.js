import fs from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';

const DATA_DIR = path.resolve('./data/railways');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'railways.db');
const STATIONS_URL = 'https://raw.githubusercontent.com/datameet/railways/master/stations.json';
const TRAINS_URL = 'https://raw.githubusercontent.com/datameet/railways/master/trains.json';
const SCHEDULES_URL = 'https://raw.githubusercontent.com/datameet/railways/master/schedules.json';
const NTES_URL = 'https://enquiry.indianrail.gov.in/mntes/javascripts/train_data.js';

async function fetchJSON(url, name) {
  console.log(`Downloading ${name}...`);
  const res = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${name}`);
  return await res.json();
}

async function fetchText(url, name) {
  console.log(`Downloading ${name}...`);
  const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${name}`);
  return await res.text();
}

function inferTrainType(name, rawType) {
  const n = String(name || '').toUpperCase();
  if (n.includes('VANDE BHARAT')) return 'VANDE BHARAT';
  if (n.includes('RAJDHANI')) return 'RAJDHANI';
  if (n.includes('SHATABDI')) return 'SHATABDI';
  if (n.includes('DURONTO')) return 'DURONTO';
  if (n.includes('HUMSAFAR')) return 'HUMSAFAR';
  if (n.includes('GARIB RATH')) return 'GARIB RATH';
  if (n.includes('TEJAS')) return 'TEJAS';
  if (n.includes('SUPERFAST') || n.includes(' SF ') || n.endsWith(' SF') || rawType === 'SF') return 'SUPERFAST';
  if (n.includes('EXPRESS') || n.includes(' EXP') || rawType === 'Exp' || rawType === 'EXPRESS') return 'EXPRESS';
  if (n.includes('MAIL') || rawType === 'Mail') return 'MAIL';
  if (n.includes('MEMU')) return 'MEMU';
  if (n.includes('DEMU')) return 'DEMU';
  if (n.includes('EMU') || n.includes('LOCAL') || n.includes('SUBURBAN')) return 'LOCAL';
  if (n.includes('PASS') || rawType === 'Pass') return 'PASSENGER';
  return 'EXPRESS';
}

export async function buildDatabase() {
  const t0 = Date.now();
  console.log('=== BUILDING COMPREHENSIVE INDIAN RAILWAYS DATABASE ===');

  const [rawStations, rawTrains, rawSchedules, ntesText] = await Promise.all([
    fetchJSON(STATIONS_URL, 'Stations (DataMeet)'),
    fetchJSON(TRAINS_URL, 'Trains (DataMeet)'),
    fetchJSON(SCHEDULES_URL, 'Schedules (DataMeet 14MB)'),
    fetchText(NTES_URL, 'NTES Live Catalog (11,472 trains)').catch(() => ''),
  ]);

  console.log(`Downloaded all files in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  // Initialize SQLite database in temporary file for atomic swap
  const tempDbPath = path.join(DATA_DIR, 'railways_temp.db');
  if (fs.existsSync(tempDbPath)) {
    try { fs.unlinkSync(tempDbPath); } catch (_) {}
  }
  const db = new DatabaseSync(tempDbPath);

  // Enable WAL mode & performance pragmas
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA synchronous = NORMAL;');
  db.exec('PRAGMA cache_size = -64000;'); // 64MB cache

  // Schema creation
  db.exec(`
    CREATE TABLE stations (
      code TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      state TEXT,
      zone TEXT,
      lat REAL,
      lon REAL,
      is_major INTEGER DEFAULT 0
    );

    CREATE TABLE trains (
      number TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT,
      from_code TEXT,
      from_name TEXT,
      to_code TEXT,
      to_name TEXT,
      departure TEXT,
      arrival TEXT,
      duration_h REAL,
      distance INTEGER,
      classes TEXT
    );

    CREATE TABLE schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      train_number TEXT NOT NULL,
      station_code TEXT NOT NULL,
      station_name TEXT,
      arrival TEXT,
      departure TEXT,
      day INTEGER DEFAULT 1,
      distance INTEGER DEFAULT 0,
      journey_min INTEGER DEFAULT 0
    );

    CREATE INDEX idx_stations_name ON stations(name);
    CREATE INDEX idx_stations_major ON stations(is_major, lat, lon);
    CREATE INDEX idx_schedules_stn ON schedules(station_code);
    CREATE INDEX idx_schedules_train ON schedules(train_number);
    CREATE INDEX idx_schedules_stn_jmin ON schedules(station_code, train_number, journey_min);
    CREATE INDEX idx_schedules_train_jmin ON schedules(train_number, journey_min);
  `);

  console.log('Populating stations table...');
  const insertStation = db.prepare(`
    INSERT OR REPLACE INTO stations (code, name, state, zone, lat, lon, is_major)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const stationFeatures = rawStations.features || rawStations;
  db.exec('BEGIN TRANSACTION;');
  let stationCount = 0;
  for (const st of stationFeatures) {
    const p = st.properties || st;
    const geom = st.geometry || {};
    const coords = geom.coordinates || [];
    const lon = coords[0] ? parseFloat(coords[0]) : null;
    const lat = coords[1] ? parseFloat(coords[1]) : null;

    if (p.code) {
      const code = String(p.code).trim().toUpperCase();
      const name = String(p.name || code).trim();
      const isMajor = /jn|junction|term|terminus|central|cantt/i.test(name) ? 1 : 0;
      insertStation.run(code, name, p.state || '', p.zone || '', lat, lon, isMajor);
      stationCount++;
    }
  }
  db.exec('COMMIT;');
  console.log(`Inserted ${stationCount} stations.`);

  console.log('Populating trains table...');
  const insertTrain = db.prepare(`
    INSERT OR REPLACE INTO trains (number, name, type, from_code, from_name, to_code, to_name, departure, arrival, duration_h, distance, classes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const trainFeatures = rawTrains.features || rawTrains;
  db.exec('BEGIN TRANSACTION;');
  let trainCount = 0;
  for (const tr of trainFeatures) {
    const p = tr.properties || tr;
    if (p.number) {
      const num = String(p.number).padStart(5, '0');
      const name = p.name || `Train ${num}`;
      const type = inferTrainType(name, p.type);
      insertTrain.run(
        num,
        name,
        type,
        p.from_station_code || '',
        p.from_station_name || '',
        p.to_station_code || '',
        p.to_station_name || '',
        p.departure || '',
        p.arrival || '',
        Number(p.duration_h) || 0,
        Number(p.distance) || 0,
        p.classes || ''
      );
      trainCount++;
    }
  }

  // Also ingest additional trains from NTES live catalog (includes locals/MEMU/DEMU/passengers)
  const insertNtesTrain = db.prepare(`
    INSERT OR IGNORE INTO trains (number, name, type, from_code, from_name, to_code, to_name, departure, arrival, duration_h, distance, classes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  if (ntesText) {
    const lines = ntesText.split('\n').filter(l => l.includes('- '));
    for (const l of lines) {
      const match = l.match(/"(\d{5})\s*-\s*([^"]+)"/);
      if (match) {
        const num = match[1];
        const name = match[2].trim();
        const type = inferTrainType(name, 'PASSENGER/LOCAL');
        insertNtesTrain.run(num, name, type, '', '', '', '', '', '', 0, 0, '');
        trainCount++;
      }
    }
  }
  db.exec('COMMIT;');
  console.log(`Indexed ${trainCount} total trains (including locals/specials/MEMU/DEMU).`);

  console.log('Populating schedules table (stop-by-stop with journey_min)...');
  const insertSchedule = db.prepare(`
    INSERT INTO schedules (train_number, station_code, station_name, arrival, departure, day, distance, journey_min)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  db.exec('BEGIN TRANSACTION;');
  let scheduleCount = 0;

  for (const row of rawSchedules) {
    const num = String(row.train_number).padStart(5, '0');
    const day = Number(row.day) || 1;
    const arr = row.arrival || '';
    const dep = row.departure || '';

    // Calculate monotonic minutes of journey: (day - 1) * 1440 + (hh * 60 + mm)
    const timeStr = (arr && arr !== 'None') ? arr : (dep && dep !== 'None' ? dep : '00:00:00');
    const [h, m] = timeStr.split(':').map(Number);
    const journeyMin = (day - 1) * 1440 + (h || 0) * 60 + (m || 0);

    insertSchedule.run(
      num,
      String(row.station_code).trim().toUpperCase(),
      row.station_name || '',
      arr,
      dep,
      day,
      Number(row.distance) || 0,
      journeyMin
    );
    scheduleCount++;
  }
  db.exec('COMMIT;');
  console.log(`Inserted ${scheduleCount} schedule stops.`);

  // Write sync metadata
  db.exec(`
    CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT);
    INSERT INTO metadata (key, value) VALUES ('last_synced_at', datetime('now'));
    INSERT INTO metadata (key, value) VALUES ('stations_count', '${stationCount}');
    INSERT INTO metadata (key, value) VALUES ('trains_count', '${trainCount}');
    INSERT INTO metadata (key, value) VALUES ('schedules_count', '${scheduleCount}');
  `);

  db.close();

  // Atomic file replace
  if (fs.existsSync(DB_PATH)) {
    try { fs.unlinkSync(DB_PATH); } catch (_) {}
  }
  fs.renameSync(tempDbPath, DB_PATH);

  const stats = fs.statSync(DB_PATH);
  console.log(`=== DATABASE BUILD COMPLETE: ${DB_PATH} (${(stats.size / 1024 / 1024).toFixed(2)} MB) in ${((Date.now() - t0) / 1000).toFixed(1)}s ===`);
  return {
    success: true,
    stationsCount: stationCount,
    trainsCount: trainCount,
    schedulesCount: scheduleCount,
    sizeMb: (stats.size / 1024 / 1024).toFixed(2),
  };
}

if (process.argv[1]?.endsWith('build_railways_sqlite.js')) {
  buildDatabase().catch(err => {
    console.error('Build database failed:', err);
    process.exit(1);
  });
}
