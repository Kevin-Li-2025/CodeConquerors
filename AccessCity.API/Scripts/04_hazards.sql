CREATE TABLE hazard_cluster (
    id                      BIGSERIAL PRIMARY KEY,
    hazard_type             hazard_type NOT NULL,
    canonical_geom          geometry(Point, 4326) NOT NULL,
    canonical_description   TEXT,
    current_status          hazard_status NOT NULL DEFAULT 'reported',
    reliability_score       NUMERIC(5,2) NOT NULL DEFAULT 0,
    severity_score          NUMERIC(5,2) NOT NULL DEFAULT 0,
    first_reported_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_reported_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    verified_at             TIMESTAMPTZ,
    resolved_at             TIMESTAMPTZ,
    created_by_feed         BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_hazard_cluster_geom 
ON hazard_cluster 
USING GIST (canonical_geom);

CREATE INDEX idx_hazard_cluster_status 
ON hazard_cluster (current_status);

