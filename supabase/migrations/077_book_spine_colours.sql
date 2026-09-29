-- 077: spine colours for the shelf design
--
-- The shelf draws every book as a spine. Its colour comes from the stored
-- cover (lib/covers/spine-colour.ts, run by the cover pipeline and by
-- `npm run covers:spines`), so it is computed once server-side instead of in
-- the browser. spine_ink is a lettering colour taken from the same cover when
-- one clearly contrasts; null means the component picks light or dark ink.
-- Books with no cover keep both null and fall back to a genre colour.

BEGIN;

ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS spine_color text,
  ADD COLUMN IF NOT EXISTS spine_ink text;

ALTER TABLE public.books
  DROP CONSTRAINT IF EXISTS books_spine_color_hex,
  DROP CONSTRAINT IF EXISTS books_spine_ink_hex;

ALTER TABLE public.books
  ADD CONSTRAINT books_spine_color_hex CHECK (spine_color ~ '^#[0-9a-f]{6}$'),
  ADD CONSTRAINT books_spine_ink_hex CHECK (spine_ink ~ '^#[0-9a-f]{6}$');

COMMENT ON COLUMN public.books.spine_color IS
  'Shelf spine colour (#rrggbb) from the stored cover; null = genre fallback';
COMMENT ON COLUMN public.books.spine_ink IS
  'Spine lettering colour (#rrggbb) from the cover when it contrasts; null = auto';

COMMIT;
