CREATE TABLE IF NOT EXISTS maintenance_ticket (
    id                      BIGSERIAL PRIMARY KEY,
    hazard_cluster_id       BIGINT REFERENCES hazard_cluster(id) ON DELETE SET NULL,
    title                   TEXT NOT NULL,
    description             TEXT,
    priority_score          NUMERIC(5,2) NOT NULL DEFAULT 0, 
    status                  ticket_status NOT NULL DEFAULT 'open',
    assigned_to_user_id     UUID REFERENCES app_user(id) ON DELETE SET NULL,
    due                     TIMESTAMPTZ,
    completed                TIMESTAMPTZ,
    CONSTRAINT chk_priority_score CHECK (priority_score BETWEEN 0 AND 100) -- Score can only be between 0 and 100
);

CREATE INDEX IF NOT EXISTS idx_maintenance_ticket_status 
ON maintenance_ticket (status);

