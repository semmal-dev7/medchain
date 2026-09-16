# Database Schema Draft (PostgreSQL)

## 1. users
- `wallet` `varchar(42)` primary key
- `role` `varchar(16)` not null check in (`patient`,`doctor`,`admin`)
- `status` `varchar(16)` not null default `active` check in (`active`,`suspended`)
- `full_name` `varchar(160)` null
- `created_at` `timestamptz` not null default now()
- `updated_at` `timestamptz` not null default now()

Indexes:
- `idx_users_role` (`role`)
- `idx_users_status` (`status`)

## 2. records
- `id` `bigserial` primary key
- `record_id` `bigint` not null unique (on-chain id)
- `patient_wallet` `varchar(42)` not null references `users(wallet)`
- `ipfs_hash` `text` not null
- `encrypted_key_ref` `text` not null
- `name` `varchar(200)` null
- `description` `text` null
- `active` `boolean` not null default true
- `tx_hash` `varchar(66)` not null
- `created_at` `timestamptz` not null default now()

Indexes:
- `idx_records_patient_wallet` (`patient_wallet`)
- `idx_records_created_at` (`created_at` desc)

## 3. access_requests
- `id` `uuid` primary key
- `record_id` `bigint` not null references `records(record_id)`
- `patient_wallet` `varchar(42)` not null references `users(wallet)`
- `doctor_wallet` `varchar(42)` not null references `users(wallet)`
- `status` `varchar(16)` not null check in (`pending`,`approved`,`rejected`,`revoked`)
- `requested_at` `timestamptz` not null default now()
- `approved_at` `timestamptz` null
- `rejected_at` `timestamptz` null
- `revoked_at` `timestamptz` null
- `request_tx_hash` `varchar(66)` null
- `decision_tx_hash` `varchar(66)` null

Constraints:
- unique pending request per doctor/record:
- partial unique index on (`record_id`,`doctor_wallet`) where `status = 'pending'`

Indexes:
- `idx_access_requests_patient` (`patient_wallet`, `status`)
- `idx_access_requests_doctor` (`doctor_wallet`, `status`)

## 4. audit_events
- `id` `bigserial` primary key
- `event_type` `varchar(64)` not null
- `actor_wallet` `varchar(42)` null
- `subject_wallet` `varchar(42)` null
- `record_id` `bigint` null
- `tx_hash` `varchar(66)` not null
- `block_number` `bigint` not null
- `log_index` `integer` not null
- `chain_id` `integer` not null
- `payload` `jsonb` not null default '{}'::jsonb
- `emitted_at` `timestamptz` not null
- `indexed_at` `timestamptz` not null default now()

Constraints:
- unique event identity: unique (`tx_hash`,`log_index`)

Indexes:
- `idx_audit_events_type` (`event_type`)
- `idx_audit_events_record` (`record_id`)
- `idx_audit_events_emitted_at` (`emitted_at` desc)

## 5. auth_nonces
- `wallet` `varchar(42)` primary key
- `nonce` `varchar(255)` not null
- `expires_at` `timestamptz` not null
- `created_at` `timestamptz` not null default now()

## 6. Optional: chain_sync_state
- `id` `smallint` primary key default 1
- `last_processed_block` `bigint` not null
- `updated_at` `timestamptz` not null default now()

Purpose:
- resume reliable event indexing after restart or failure.
