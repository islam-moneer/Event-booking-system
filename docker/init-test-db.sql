-- Runs once, on first container start, after ebs_dev is created.
-- The test database is separate so the suite can truncate freely without
-- destroying seeded development data.
CREATE DATABASE ebs_test OWNER ebs;
