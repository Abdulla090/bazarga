-- Phone backfill: v1 checkout stored Iraqi mobiles as "9647XXXXXXXXX"; since the sprint they are E.164
-- "+9647XXXXXXXXX". A returning shopper therefore got a second customer row (customers_store_phone_uq saw two
-- different strings). This migration:
--   1. merges every store's customer rows that are the same number once normalised — keeps the OLDEST row,
--      repoints orders to it, sums orders_count / total_spent, keeps the latest last_order_at, and takes
--      name / address / area / landmark from the row with the most recent order (the shopper's current details);
--   2. rewrites remaining customers.phone and orders.customer_phone "9647…" → "+9647…".
-- Only exact legacy Iraqi mobiles (^9647 + 9 digits) are touched; anything else is left as it is. Idempotent.

DROP TABLE IF EXISTS _customer_merge;
--> statement-breakpoint
CREATE TEMP TABLE _customer_merge AS
WITH norm AS (
  SELECT id, store_id, created_at, last_order_at,
         CASE WHEN phone ~ '^9647[0-9]{9}$' THEN '+' || phone ELSE phone END AS np
  FROM customers
)
SELECT id,
       store_id,
       np,
       first_value(id) OVER (PARTITION BY store_id, np ORDER BY created_at, id) AS keep_id,
       count(*) OVER (PARTITION BY store_id, np) AS n,
       last_order_at,
       created_at
FROM norm;
--> statement-breakpoint
DELETE FROM _customer_merge WHERE n < 2;
--> statement-breakpoint
UPDATE orders o
SET customer_id = m.keep_id
FROM _customer_merge m
WHERE o.customer_id = m.id AND m.id <> m.keep_id;
--> statement-breakpoint
WITH agg AS (
  SELECT m.keep_id,
         sum(c.orders_count)::int AS orders_count,
         sum(c.total_spent)::int AS total_spent,
         max(c.last_order_at) AS last_order_at
  FROM _customer_merge m JOIN customers c ON c.id = m.id
  GROUP BY m.keep_id
), latest AS (
  SELECT DISTINCT ON (m.keep_id) m.keep_id, c.name, c.city_key, c.address, c.area_name, c.landmark
  FROM _customer_merge m JOIN customers c ON c.id = m.id
  ORDER BY m.keep_id, c.last_order_at DESC NULLS LAST, c.created_at DESC, c.id
)
UPDATE customers c
SET orders_count = agg.orders_count,
    total_spent = agg.total_spent,
    last_order_at = agg.last_order_at,
    name = latest.name,
    city_key = latest.city_key,
    address = latest.address,
    area_name = latest.area_name,
    landmark = latest.landmark
FROM agg JOIN latest ON latest.keep_id = agg.keep_id
WHERE c.id = agg.keep_id;
--> statement-breakpoint
DELETE FROM customers c
USING _customer_merge m
WHERE c.id = m.id AND m.id <> m.keep_id;
--> statement-breakpoint
UPDATE customers SET phone = '+' || phone WHERE phone ~ '^9647[0-9]{9}$';
--> statement-breakpoint
UPDATE orders SET customer_phone = '+' || customer_phone WHERE customer_phone ~ '^9647[0-9]{9}$';
--> statement-breakpoint
DROP TABLE _customer_merge;
