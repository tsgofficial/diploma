/**
 * Typed environment loader.
 *
 * Plain module — reads process.env once and exposes a frozen `env` object.
 * No classes; validation is a simple guard function.
 */
import dotenv from 'dotenv';

dotenv.config();

function required(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.trim() ? value : fallback;
}

export const env = Object.freeze({
  PORT: Number(optional('PORT', '4000')),
  DATABASE_URL: required('DATABASE_URL'),
  JWT_SECRET: optional('JWT_SECRET', 'dev-jwt-secret-change-me'),
  JWT_EXPIRES_IN: optional('JWT_EXPIRES_IN', '7d'),
  RAG_ENGINE_URL: optional('RAG_ENGINE_URL', 'http://localhost:8000'),
  RAG_INTERNAL_KEY: optional('RAG_INTERNAL_KEY', 'dev-internal-key-change-me'),
  RAG_TIMEOUT_MS: Number(optional('RAG_TIMEOUT_MS', '30000')),
  CORS_ORIGIN: optional('CORS_ORIGIN', 'http://localhost:3000'),
});
