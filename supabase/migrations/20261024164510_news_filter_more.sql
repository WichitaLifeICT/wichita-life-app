-- Keep the news feed light: no crime, sexual content, death or restaurant health-inspection stories. Headlines are now checked
-- together with their summary, and the blocked-word list (public.news_blocked_words, editable
-- in the Supabase table editor) covers far more. Adding words re-checks every headline.

create or replace function private.filter_news_item()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  new.filtered := private.news_title_blocked(coalesce(new.title, '') || ' ' || coalesce(new.summary, ''));
  return new;
end;
$$;

create or replace function private.refilter_news()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  update public.news_items n
    set filtered = private.news_title_blocked(coalesce(n.title, '') || ' ' || coalesce(n.summary, ''))
    where n.filtered is distinct from private.news_title_blocked(coalesce(n.title, '') || ' ' || coalesce(n.summary, ''));
  return null;
end;
$$;

insert into public.news_blocked_words (word) values
  -- Death
  ('deadly'), ('death toll'), ('dying'), ('fatality'), ('fatalities'), ('casualties'), ('corpse'), ('remains found'),
  ('human remains'), ('obituary'), ('obituaries'), ('suicide'), ('suicides'), ('suicidal'), ('drowned'), ('drowning'),
  ('overdose'), ('overdoses'), ('overdosed'), ('autopsy'), ('coroner'), ('lost their life'), ('lost his life'),
  ('lost her life'), ('passed away'),
  -- Crime and violence
  ('crime'), ('crimes'), ('criminal'), ('criminals'), ('arrest'), ('arrests'), ('arrested'), ('jail'), ('jailed'),
  ('prison'), ('inmate'), ('inmates'), ('sentenced'), ('sentencing'), ('convicted'), ('conviction'), ('pleads guilty'),
  ('pleaded guilty'), ('found guilty'), ('felony'), ('felonies'), ('felon'), ('suspect'), ('suspects'), ('accused'),
  ('indicted'), ('indictment'), ('charged with'), ('assault'), ('assaulted'), ('robbery'), ('robberies'),
  ('robbed'), ('burglary'), ('burglaries'), ('theft'), ('stolen'), ('shoplifting'), ('carjacking'), ('carjacked'),
  ('kidnap'), ('kidnapped'), ('kidnapping'), ('abduction'), ('abducted'), ('shots fired'), ('gun'), ('guns'),
  ('firearm'), ('firearms'), ('weapon'), ('weapons'), ('standoff'), ('manhunt'), ('hostage'), ('victim'),
  ('victims'), ('violence'), ('violent'), ('domestic violence'), ('abuse'), ('abused'), ('child abuse'),
  ('trafficking'), ('drug bust'), ('fentanyl'), ('meth'), ('stab'), ('stabs'), ('bomb'), ('bomb threat'), ('terror'),
  ('terrorist'), ('terrorism'), ('massacre'), ('hate crime'), ('police chase'), ('fugitive'), ('fatal crash'), ('deadly crash'),
  -- Sexual content
  ('porn'), ('porno'), ('pornography'), ('pornographic'), ('child pornography'), ('sex'), ('sexual'), ('sexually'),
  ('sex offender'), ('sex crimes'), ('rape'), ('raped'), ('rapist'), ('molest'), ('molested'), ('molestation'),
  ('indecent'), ('obscene'), ('lewd'), ('nude'), ('nudity'), ('naked'), ('prostitution'), ('strip club'),
  ('onlyfans'), ('grooming'), ('predator'), ('predators'),
  -- Restaurant health inspections
  ('health inspection'), ('health inspections'), ('health inspector'), ('health inspectors'), ('inspection'),
  ('inspections'), ('inspectors'), ('health violations'), ('violations'), ('roach'), ('roaches'), ('cockroach'),
  ('cockroaches'), ('rodent'), ('rodents'), ('mouse droppings'), ('rotting mouse'), ('dead mouse'), ('mice'), ('rats'),
  ('droppings'), ('sludge'), ('rotting'), ('mold'), ('moldy'), ('slime'), ('unsanitary'), ('filthy'),
  ('kitchen nightmares'), ('food safety')
on conflict (word) do nothing;
