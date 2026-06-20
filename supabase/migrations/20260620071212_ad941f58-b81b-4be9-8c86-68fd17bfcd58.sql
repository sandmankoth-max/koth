
CREATE OR REPLACE FUNCTION public.trg_notify_friendship()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  v_requester_username text;
  v_addressee_username text;
begin
  if TG_OP = 'INSERT' and new.status = 'pending' then
    select username into v_requester_username from public.profiles where id = new.requester_id;
    insert into public.notifications(user_id, type, payload)
    values (new.addressee_id, 'friend_request',
      jsonb_build_object('from_user_id', new.requester_id, 'from_username', v_requester_username, 'friendship_id', new.id));
  elsif TG_OP = 'UPDATE' and new.status = 'accepted' and old.status <> 'accepted' then
    select username into v_addressee_username from public.profiles where id = new.addressee_id;
    insert into public.notifications(user_id, type, payload)
    values (new.requester_id, 'friend_accepted',
      jsonb_build_object('from_user_id', new.addressee_id, 'from_username', v_addressee_username, 'friendship_id', new.id));
  end if;
  return new;
end;
$$;

DROP TRIGGER IF EXISTS friendships_notify_insert ON public.friendships;
CREATE TRIGGER friendships_notify_insert
AFTER INSERT ON public.friendships
FOR EACH ROW EXECUTE FUNCTION public.trg_notify_friendship();

DROP TRIGGER IF EXISTS friendships_notify_update ON public.friendships;
CREATE TRIGGER friendships_notify_update
AFTER UPDATE ON public.friendships
FOR EACH ROW EXECUTE FUNCTION public.trg_notify_friendship();
