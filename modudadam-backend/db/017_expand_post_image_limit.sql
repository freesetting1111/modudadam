ALTER TABLE post_images
  DROP CONSTRAINT IF EXISTS post_images_sort_order_check;

ALTER TABLE post_images
  ADD CONSTRAINT post_images_sort_order_check
  CHECK (sort_order >= 0 AND sort_order < 10);
