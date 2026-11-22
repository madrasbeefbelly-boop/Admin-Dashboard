CREATE SEQUENCE IF NOT EXISTS order_ref_seq START WITH 1;
SELECT setval('order_ref_seq', GREATEST((SELECT count(*) FROM orders), 1));
