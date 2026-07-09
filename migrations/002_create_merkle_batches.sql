-- Merkle-style batching: every BATCH_SIZE (10) log entries get rolled up
-- into a single batch_hash, derived from the individual current_hash
-- values in that range. This does NOT replace the existing per-entry
-- hash chain in `logs` — it's an additional integrity layer on top of it.

CREATE TABLE IF NOT EXISTS merkle_batches (
    id BIGSERIAL PRIMARY KEY,

    start_log_id BIGINT NOT NULL,
    end_log_id BIGINT NOT NULL,

    batch_hash TEXT NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_batch_range UNIQUE (start_log_id, end_log_id)
);

CREATE INDEX IF NOT EXISTS idx_merkle_batches_end_log_id
ON merkle_batches(end_log_id);