-- Table pour les paramètres de l'application
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insertion des valeurs par défaut
INSERT INTO settings (key, value) VALUES 
('cache_duration', '7') ON CONFLICT (key) DO NOTHING;

INSERT INTO settings (key, value) VALUES 
('price_threshold', '0.50') ON CONFLICT (key) DO NOTHING;
