-- Migration: 001_add_app_url_to_clients
-- Description: Adds app_url column to clients table for Auto-jump feature.

ALTER TABLE clients ADD COLUMN app_url VARCHAR(500);
