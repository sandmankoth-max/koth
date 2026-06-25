CREATE OR REPLACE FUNCTION public.handle_new_submission()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_colors text[] := array['red','blue','green','yellow','purple'];
begin
  if new.visibility = 'public' then
    update public.submissions
      set is_active_entry = false
      where user_id = new.user_id
        and challenge_id = new.challenge_id
        and id <> new.id
        and is_active_entry = true;
    new.is_active_entry := true;
    if new.status is null then
      new.status := 'pending_review';
    end if;
    if new.admin_color is null then
      new.admin_color := v_colors[1 + floor(random() * 5)::int];
    end if;
  else
    new.is_active_entry := false;
    new.status := 'verified';
    new.admin_color := null;
  end if;
  return new;
end;
$function$;

-- Backfill: assign random colors to existing public submissions that lack one
UPDATE public.submissions
SET admin_color = (ARRAY['red','blue','green','yellow','purple'])[1 + floor(random() * 5)::int]
WHERE visibility = 'public' AND admin_color IS NULL;