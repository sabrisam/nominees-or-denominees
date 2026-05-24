-- Migration: Create tiktokers table and link nominations
CREATE TABLE IF NOT EXISTS public.tiktokers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add column tiktoker_id to nominations table referencing tiktokers(id)
ALTER TABLE public.nominations ADD COLUMN IF NOT EXISTS tiktoker_id UUID REFERENCES public.tiktokers(id) ON DELETE SET NULL;

-- Enable RLS on tiktokers table
ALTER TABLE public.tiktokers ENABLE ROW LEVEL SECURITY;

-- Allow select for all users
DROP POLICY IF EXISTS "Enable read access for all users" ON public.tiktokers;
CREATE POLICY "Enable read access for all users" ON public.tiktokers FOR SELECT USING (true);

-- Allow insert/update for anon and authenticated users
DROP POLICY IF EXISTS "Enable insert for all users" ON public.tiktokers;
CREATE POLICY "Enable insert for all users" ON public.tiktokers FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Enable update for all users" ON public.tiktokers;
CREATE POLICY "Enable update for all users" ON public.tiktokers FOR UPDATE USING (true);
