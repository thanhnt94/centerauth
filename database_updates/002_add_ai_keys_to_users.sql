-- Migration: Add AI Provider configuration columns to users table
-- Target: CentralAuth Main Database

ALTER TABLE users ADD COLUMN active_provider VARCHAR(50) DEFAULT 'google';
ALTER TABLE users ADD COLUMN google_api_key VARCHAR(500);
ALTER TABLE users ADD COLUMN google_model VARCHAR(255) DEFAULT 'gemini-2.0-flash';
ALTER TABLE users ADD COLUMN openai_api_key VARCHAR(500);
ALTER TABLE users ADD COLUMN openai_model VARCHAR(255) DEFAULT 'gpt-4o';
ALTER TABLE users ADD COLUMN anthropic_api_key VARCHAR(500);
ALTER TABLE users ADD COLUMN anthropic_model VARCHAR(255) DEFAULT 'claude-3-5-sonnet';
ALTER TABLE users ADD COLUMN groq_api_key VARCHAR(500);
ALTER TABLE users ADD COLUMN groq_model VARCHAR(255) DEFAULT 'llama-3.3-70b-versatile';
ALTER TABLE users ADD COLUMN cerebras_api_key VARCHAR(500);
ALTER TABLE users ADD COLUMN cerebras_model VARCHAR(255) DEFAULT 'llama3.1-8b';
ALTER TABLE users ADD COLUMN nvidia_api_key VARCHAR(500);
ALTER TABLE users ADD COLUMN nvidia_model VARCHAR(255) DEFAULT 'meta/llama-3.3-70b-instruct';
ALTER TABLE users ADD COLUMN sambanova_api_key VARCHAR(500);
ALTER TABLE users ADD COLUMN sambanova_model VARCHAR(255) DEFAULT 'Meta-Llama-3.3-70B-Instruct';
ALTER TABLE users ADD COLUMN mistral_api_key VARCHAR(500);
ALTER TABLE users ADD COLUMN mistral_model VARCHAR(255) DEFAULT 'mistral-large-latest';
ALTER TABLE users ADD COLUMN cloudflare_api_key VARCHAR(500);
ALTER TABLE users ADD COLUMN cloudflare_model VARCHAR(255) DEFAULT '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
ALTER TABLE users ADD COLUMN github_models_api_key VARCHAR(500);
ALTER TABLE users ADD COLUMN github_models_model VARCHAR(255) DEFAULT 'gpt-4o';
ALTER TABLE users ADD COLUMN cohere_api_key VARCHAR(500);
ALTER TABLE users ADD COLUMN cohere_model VARCHAR(255) DEFAULT 'command-r-plus';
ALTER TABLE users ADD COLUMN huggingface_api_key VARCHAR(500);
ALTER TABLE users ADD COLUMN huggingface_model VARCHAR(255) DEFAULT 'meta-llama/Llama-3.3-70B-Instruct';
ALTER TABLE users ADD COLUMN fireworks_api_key VARCHAR(500);
ALTER TABLE users ADD COLUMN fireworks_model VARCHAR(255) DEFAULT 'accounts/fireworks/models/llama-v3p3-70b-instruct';
ALTER TABLE users ADD COLUMN api_keys_json VARCHAR(4000) DEFAULT '[]';
ALTER TABLE users ADD COLUMN active_key_id VARCHAR(255);
