// Connexion MySQL — pool de connexions partagé
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// TLS pour les bases MySQL managées (TiDB, Aiven, PlanetScale…) qui l'exigent.
//   DB_SSL=true       → connexion chiffrée, certificat vérifié (cas normal) ;
//   DB_SSL=no-verify  → chiffré mais sans vérifier le certificat (repli si CA absente) ;
//   absent/false      → pas de TLS (MySQL local / réseau privé).
export function configSsl() {
  const v = (process.env.DB_SSL || '').toLowerCase();
  if (v === 'true' || v === '1') return { minVersion: 'TLSv1.2', rejectUnauthorized: true };
  if (v === 'no-verify' || v === 'skip-verify') return { rejectUnauthorized: false };
  return undefined;
}

export const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'lekol_pam',
  ssl: configSsl(),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4_unicode_ci',
});

// Vérifie que la base répond au démarrage
export async function testConnection() {
  const conn = await pool.getConnection();
  try {
    await conn.ping();
  } finally {
    conn.release();
  }
}
