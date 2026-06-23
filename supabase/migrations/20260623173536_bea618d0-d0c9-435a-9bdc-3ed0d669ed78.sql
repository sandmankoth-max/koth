
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS admin_color text
  CHECK (admin_color IS NULL OR admin_color IN ('red','blue','green','yellow','purple'));

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
