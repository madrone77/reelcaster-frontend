-- /lp/q/<city> is the quiz landing page (src/app/lp/q). Its key is "lpq",
-- matching what the page sends to the campaign counter, so a trial that
-- started on the quiz is credited to it in Campaign results. The city is a
-- column of its own, as it is for /lp/<n>/<city>.
create or replace function public.campaign_lp_key(p_path text)
returns text
language sql
immutable
set search_path to 'public'
as $function$
  select case
    when parts is null then ''
    -- /lp/q and /lp/q/<city>: the quiz.
    when parts[1] = 'q' then 'lpq'
    -- /lp/<n> and /lp/<n>/<city>: the variant is the number, and which city
    -- it served is a column of its own in the counter, not part of the key.
    when parts[1] ~ '^[0-9]{1,2}$' then 'lp' || parts[1]
    -- /lp/<city>/<n>: the city is part of the identity of the page.
    when parts[2] ~ '^[0-9]{1,2}$'
      then 'lp' || regexp_replace(parts[1], '[^a-z0-9]', '', 'g') || parts[2]
    else ''
  end
  from (
    select regexp_match(
      lower(coalesce(p_path, '')),
      '^/lp/([a-z0-9-]{1,24})(?:/([a-z0-9-]{1,24}))?'
    ) as parts
  ) m;
$function$;
