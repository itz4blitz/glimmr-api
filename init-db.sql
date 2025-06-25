-- Initialize Glimmr Database
-- This file is executed when the PostgreSQL container starts for the first time

-- Create the main database (already created by POSTGRES_DB env var)
-- CREATE DATABASE glimmr_dev;

-- Create any additional users if needed
-- The postgres user is already created by the container

-- Set up any initial database configuration
-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- You can add any initial table creation or data seeding here
-- For now, we'll let the application handle schema creation via migrations
