import pg from 'pg'

const { Pool } = pg

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('neon.tech') ? { rejectUnauthorized: false } : undefined,
})

export async function migrate() {
  await pool.query(`
    create extension if not exists "pgcrypto";

    create table if not exists users (
      id uuid primary key default gen_random_uuid(),
      name text not null,
      email text unique not null,
      password_hash text not null,
      role text not null check (role in ('student', 'faculty', 'admin')),
      created_at timestamptz not null default now()
    );

    create table if not exists courses (
      id uuid primary key default gen_random_uuid(),
      title text not null,
      code text unique not null,
      faculty_id uuid references users(id),
      latitude double precision not null default 28.6139,
      longitude double precision not null default 77.2090,
      radius_meters integer not null default 120,
      created_at timestamptz not null default now()
    );

    create table if not exists attendance_sessions (
      id uuid primary key default gen_random_uuid(),
      course_id uuid references courses(id),
      faculty_id uuid references users(id),
      encrypted_payload text not null,
      expires_at timestamptz not null,
      active boolean not null default true,
      created_at timestamptz not null default now()
    );

    create table if not exists attendance_records (
      id uuid primary key default gen_random_uuid(),
      session_id uuid references attendance_sessions(id),
      student_id uuid references users(id),
      latitude double precision not null,
      longitude double precision not null,
      distance_meters double precision not null,
      ip_address text,
      user_agent text,
      status text not null,
      risk_score integer not null default 0,
      created_at timestamptz not null default now(),
      unique(session_id, student_id)
    );

    create table if not exists assignments (
      id uuid primary key default gen_random_uuid(),
      course_id uuid references courses(id),
      student_id uuid references users(id),
      title text not null,
      file_path text not null,
      status text not null default 'uploaded',
      ai_summary text,
      created_at timestamptz not null default now()
    );

    create table if not exists audit_logs (
      id uuid primary key default gen_random_uuid(),
      actor_id uuid references users(id),
      action text not null,
      metadata jsonb not null default '{}',
      created_at timestamptz not null default now()
    );
  `)
}
