-- ============================================
-- 007: User Locations + Places Feature
-- ============================================
-- Adds opt-in approximate location for users,
-- places cache for OSM data, and community-submitted places.

-- ============================================
-- 1) User Location Fields (on profiles)
-- ============================================

-- Add location fields to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS location_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS location_geohash text,
ADD COLUMN IF NOT EXISTS location_label text,
ADD COLUMN IF NOT EXISTS location_precision integer DEFAULT 6,
ADD COLUMN IF NOT EXISTS location_updated_at timestamptz;

-- Index for finding nearby users by geohash prefix
CREATE INDEX IF NOT EXISTS idx_profiles_location_geohash 
ON public.profiles (location_geohash) 
WHERE location_enabled = true AND location_geohash IS NOT NULL;

-- Index for filtering by location_enabled
CREATE INDEX IF NOT EXISTS idx_profiles_location_enabled 
ON public.profiles (location_enabled) 
WHERE location_enabled = true;

-- ============================================
-- 2) Places Cache (OSM/Overpass data)
-- ============================================

CREATE TABLE IF NOT EXISTS public.places_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  geohash_prefix text NOT NULL,
  place_type text NOT NULL,
  data jsonb NOT NULL DEFAULT '[]'::jsonb,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  
  UNIQUE(geohash_prefix, place_type)
);

-- Index for cache lookups
CREATE INDEX IF NOT EXISTS idx_places_cache_lookup 
ON public.places_cache (geohash_prefix, place_type, expires_at);

-- ============================================
-- 3) Community Places (user-submitted, approved)
-- ============================================

CREATE TABLE IF NOT EXISTS public.places (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  place_type text NOT NULL CHECK (place_type IN ('bookstore', 'library', 'cafe', 'bookclub', 'popup', 'other')),
  address text,
  city text,
  country text,
  lat numeric(10, 7),
  lng numeric(10, 7),
  geohash text,
  website text,
  description text,
  submitted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes for places
CREATE INDEX IF NOT EXISTS idx_places_geohash ON public.places (geohash);
CREATE INDEX IF NOT EXISTS idx_places_type ON public.places (place_type);
CREATE INDEX IF NOT EXISTS idx_places_city ON public.places (city);

-- Enable RLS
ALTER TABLE public.places ENABLE ROW LEVEL SECURITY;

-- Anyone can read approved places
CREATE POLICY "Anyone can read places"
ON public.places FOR SELECT
USING (true);

-- Only admins can insert/update/delete directly
CREATE POLICY "Admins can manage places"
ON public.places FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.is_admin = true
  )
);

-- ============================================
-- 4) Place Submissions (moderation queue)
-- ============================================

CREATE TABLE IF NOT EXISTS public.place_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  place_type text NOT NULL CHECK (place_type IN ('bookstore', 'library', 'cafe', 'bookclub', 'popup', 'other')),
  address text,
  city text,
  country text,
  lat numeric(10, 7),
  lng numeric(10, 7),
  geohash text,
  website text,
  description text,
  submitted_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  moderator_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  moderator_notes text,
  created_at timestamptz DEFAULT now(),
  reviewed_at timestamptz
);

-- Index for moderation queue
CREATE INDEX IF NOT EXISTS idx_place_submissions_status ON public.place_submissions (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_place_submissions_user ON public.place_submissions (submitted_by);

-- Enable RLS
ALTER TABLE public.place_submissions ENABLE ROW LEVEL SECURITY;

-- Users can view their own submissions
CREATE POLICY "Users can view own submissions"
ON public.place_submissions FOR SELECT
USING (submitted_by = auth.uid());

-- Admins can view all submissions
CREATE POLICY "Admins can view all submissions"
ON public.place_submissions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.is_admin = true
  )
);

-- Authenticated users can submit places
CREATE POLICY "Authenticated users can submit places"
ON public.place_submissions FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND submitted_by = auth.uid());

-- Admins can update submissions (for moderation)
CREATE POLICY "Admins can moderate submissions"
ON public.place_submissions FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.is_admin = true
  )
);

-- ============================================
-- 5) RLS for places_cache (server-only access)
-- ============================================

ALTER TABLE public.places_cache ENABLE ROW LEVEL SECURITY;

-- No public access to cache - only server (service role) can read/write
-- This is intentional - the cache is managed by the API routes

-- ============================================
-- 6) Function to approve a place submission
-- ============================================

CREATE OR REPLACE FUNCTION public.approve_place_submission(
  submission_id uuid,
  admin_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_place_id uuid;
  submission_record record;
BEGIN
  -- Get the submission
  SELECT * INTO submission_record
  FROM public.place_submissions
  WHERE id = submission_id AND status = 'pending';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Submission not found or already processed';
  END IF;
  
  -- Insert into places
  INSERT INTO public.places (
    name, place_type, address, city, country,
    lat, lng, geohash, website, description, submitted_by
  )
  VALUES (
    submission_record.name,
    submission_record.place_type,
    submission_record.address,
    submission_record.city,
    submission_record.country,
    submission_record.lat,
    submission_record.lng,
    submission_record.geohash,
    submission_record.website,
    submission_record.description,
    submission_record.submitted_by
  )
  RETURNING id INTO new_place_id;
  
  -- Update submission status
  UPDATE public.place_submissions
  SET 
    status = 'approved',
    moderator_id = auth.uid(),
    moderator_notes = admin_notes,
    reviewed_at = now()
  WHERE id = submission_id;
  
  RETURN new_place_id;
END;
$$;

-- ============================================
-- 7) Function to reject a place submission
-- ============================================

CREATE OR REPLACE FUNCTION public.reject_place_submission(
  submission_id uuid,
  admin_notes text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.place_submissions
  SET 
    status = 'rejected',
    moderator_id = auth.uid(),
    moderator_notes = admin_notes,
    reviewed_at = now()
  WHERE id = submission_id AND status = 'pending';
  
  RETURN FOUND;
END;
$$;

