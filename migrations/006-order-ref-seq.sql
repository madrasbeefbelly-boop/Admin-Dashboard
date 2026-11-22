CREATE SEQUENCE IF NOT EXISTS order_ref_seq START WITH 1;
GRANT ALL PRIVILEGES ON SEQUENCE order_ref_seq TO public, anon, authenticated, service_role, postgres;
SELECT setval('order_ref_seq', GREATEST((SELECT count(*) FROM orders), 1));
