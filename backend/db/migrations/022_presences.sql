-- Migration 022 : présence quotidienne (scan du QR du badge)
-- Une ligne = un élève confirmé présent un jour donné. L'absence de ligne pour
-- une date vaut « non pointé » (pas de suivi explicite des absences pour l'instant).
CREATE TABLE IF NOT EXISTS presences (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  id_eleve      INT NOT NULL,
  date          DATE NOT NULL,
  heure_arrivee DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  marque_par    INT,
  UNIQUE KEY uniq_eleve_date (id_eleve, date),
  FOREIGN KEY (id_eleve) REFERENCES eleves(id) ON DELETE CASCADE,
  FOREIGN KEY (marque_par) REFERENCES utilisateurs(id) ON DELETE SET NULL
) ENGINE=InnoDB;
