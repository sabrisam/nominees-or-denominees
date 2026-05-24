-- Migration: Create get_pending_nominations RPC function to support persistent device voter checks
CREATE OR REPLACE FUNCTION public.get_pending_nominations(room_id_param UUID, device_id_param text)
RETURNS SETOF public.nominations AS $$
BEGIN
    RETURN QUERY
    SELECT n.*
    FROM public.nominations n
    WHERE n.room_id = room_id_param
      AND n.status = 'pending'
      AND NOT EXISTS (
          SELECT 1 
          FROM public.ratings r 
          WHERE r.nomination_id = n.id 
            AND r.voter_id = device_id_param
      );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
