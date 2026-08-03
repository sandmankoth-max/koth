CREATE OR REPLACE FUNCTION public.friend_count(_user uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::int
  FROM public.friendships f
  WHERE f.status = 'accepted'
    AND (f.requester_id = _user OR f.addressee_id = _user)
$$;

CREATE OR REPLACE FUNCTION public.friend_list(_user uuid)
RETURNS TABLE(friendship_id uuid, id uuid, username text, display_name text, avatar_url text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT f.id,
         p.id,
         p.username,
         p.display_name,
         p.avatar_url
  FROM public.friendships f
  JOIN public.profiles p
    ON p.id = CASE WHEN f.requester_id = _user THEN f.addressee_id ELSE f.requester_id END
  WHERE f.status = 'accepted'
    AND (f.requester_id = _user OR f.addressee_id = _user)
    AND (
      auth.uid() = _user
      OR public.are_friends(auth.uid(), _user)
      OR public.is_staff(auth.uid())
    )
  ORDER BY p.username
$$;

GRANT EXECUTE ON FUNCTION public.friend_count(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.friend_list(uuid) TO authenticated;