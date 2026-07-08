CREATE TABLE IF NOT EXISTS logs (
    id BIGSERIAL PRIMARY KEY,

    actor VARCHAR(100) NOT NULL,

    action VARCHAR(255) NOT NULL,

    payload JSONB NOT NULL,

    previous_hash TEXT,

    current_hash TEXT NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_logs_actor
ON logs(actor);

CREATE INDEX idx_logs_created_at
ON logs(created_at);