-- Add a human-readable audit trail for FC25 dataset versions created by admin tooling.

ALTER TABLE fc25_dataset_versions ADD COLUMN description TEXT;
