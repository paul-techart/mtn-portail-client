-- Script de création de la base de données du Portail Client MTN
-- À importer directement dans phpMyAdmin (onglet "Importer")

CREATE DATABASE IF NOT EXISTS mtn_portail_client
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE mtn_portail_client;

-- Table des utilisateurs (clients et agents)
CREATE TABLE IF NOT EXISTS utilisateurs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nom VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  mot_de_passe VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'client',
  solde INT NOT NULL DEFAULT 0,
  bloque TINYINT(1) NOT NULL DEFAULT 0,

  -- Colonnes du forfait actif (NULL si aucun forfait en cours)
  forfait_nom VARCHAR(255) NULL,
  forfait_data_total INT NULL,
  forfait_data_restant INT NULL,
  forfait_appels_total INT NULL,
  forfait_appels_restant INT NULL,
  forfait_sms_total INT NULL,
  forfait_sms_restant INT NULL,
  forfait_date_achat DATETIME NULL,
  forfait_date_expiration DATETIME NULL,

  date_creation DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table de l'historique des transactions (une ligne = une action)
CREATE TABLE IF NOT EXISTS historique (
  id INT AUTO_INCREMENT PRIMARY KEY,
  utilisateur_id INT NOT NULL,
  type VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  montant INT NOT NULL DEFAULT 0,
  date DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id) ON DELETE CASCADE
);

-- Table des forfaits disponibles à l'achat
CREATE TABLE IF NOT EXISTS forfaits (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nom VARCHAR(255) NOT NULL,
  prix INT NOT NULL,
  data_mo INT NOT NULL,
  appels_min INT NOT NULL,
  sms INT NOT NULL,
  validite_jours INT NOT NULL
);

-- Données de départ pour les forfaits (uniquement si la table est vide)
INSERT INTO forfaits (nom, prix, data_mo, appels_min, sms, validite_jours)
SELECT * FROM (SELECT
  'MTN Night Data' AS nom, 500 AS prix, 2000 AS data_mo, 0 AS appels_min, 0 AS sms, 1 AS validite_jours
  UNION ALL SELECT 'MTN Family Mix 1000F', 1000, 500, 60, 50, 7
  UNION ALL SELECT 'MTN Family Mix 2000F', 2000, 1200, 150, 100, 15
  UNION ALL SELECT 'MTN Family Mix 5000F', 5000, 4000, 400, 300, 30
) AS donnees_initiales
WHERE NOT EXISTS (SELECT 1 FROM forfaits);
