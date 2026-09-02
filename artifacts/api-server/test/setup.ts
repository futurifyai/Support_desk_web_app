process.env["DATABASE_URL"] ??= "postgresql://test:test@127.0.0.1:5432/supportdesk_test";
process.env["SESSION_SECRET"] ??= "test-session-secret-that-is-at-least-32-chars";