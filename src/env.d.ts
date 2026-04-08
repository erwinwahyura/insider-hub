/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

// Cloudflare D1 binding type
type D1Database = {
  prepare(query: string): D1PreparedStatement;
  exec(query: string): Promise<D1Result>;
  batch(statements: D1PreparedStatement[]): Promise<D1Result[]>;
  dump(): Promise<ArrayBuffer>;
};

type D1PreparedStatement = {
  bind(...values: (string | number | null)[]): D1PreparedStatement;
  first<T>(): Promise<T | null>;
  run(): Promise<D1Result>;
  all<T>(): Promise<{ results: T[]; lastRowId: number; changes: number }>;
  raw<T>(): Promise<T[]>;
};

type D1Result = {
  success: boolean;
  meta?: {
    lastRowId: number;
    changes: number;
    duration: number;
  };
  error?: {
    message: string;
  };
};

declare namespace App {
  interface Locals {
    runtime: {
      env: {
        DB: D1Database;
        CLERK_SECRET_KEY: string;
        PUBLIC_CLERK_PUBLISHABLE_KEY: string;
      };
    };
    auth: {
      userId: string | null;
      sessionId: string | null;
    };
  }
}
