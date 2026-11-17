-- PriceRadar CLOUD P0 / MANUAL-ONLY FUTURE SCHEMA (NOT DEPLOYED, NOT ACCEPTANCE-TESTED)
-- Intentionally a draft, NOT a Supabase CLI migration. Apply only in an isolated
-- staging project after a security review and RLS integration tests.
-- No provider connector or licensed commercial data is installed by this file.
BEGIN;
CREATE SCHEMA IF NOT EXISTS radar_internal;
REVOKE ALL ON SCHEMA radar_internal FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.radar_profiles (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 locale text NOT NULL DEFAULT 'es-ES' CHECK(locale='es-ES'),
 timezone text NOT NULL DEFAULT 'Europe/Madrid' CHECK(timezone='Europe/Madrid'),
 theme text NOT NULL DEFAULT 'dark' CHECK(theme IN ('dark','light')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.radar_manual_products (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 name text NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 150),
 brand text, model text, variant_description text NOT NULL,
 condition text NOT NULL CHECK(condition IN ('new','refurbished')),
 category text NOT NULL DEFAULT 'Otros',
 region text NOT NULL DEFAULT 'ES' CHECK(region='ES'),
 gtin text,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id,id)
);
CREATE TABLE IF NOT EXISTS public.radar_manual_offers (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 product_id uuid NOT NULL,
 merchant_name text NOT NULL CHECK(length(trim(merchant_name)) BETWEEN 1 AND 100),
 source_url text,
 condition text NOT NULL CHECK(condition IN ('new','refurbished')),
 region text NOT NULL DEFAULT 'ES' CHECK(region='ES'),
 currency text NOT NULL DEFAULT 'EUR' CHECK(currency='EUR'),
 source_kind text NOT NULL DEFAULT 'manual' CHECK(source_kind='manual'),
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(user_id,product_id) REFERENCES public.radar_manual_products(user_id,id) ON DELETE CASCADE,
 UNIQUE(user_id,id), UNIQUE(user_id,id,product_id)
);
CREATE TABLE IF NOT EXISTS public.radar_manual_observations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 offer_id uuid NOT NULL,
 price_cents bigint NOT NULL CHECK(price_cents>0 AND price_cents<=99999999999),
 shipping_cents bigint CHECK(shipping_cents>=0 AND shipping_cents<=99999999999),
 taxes_included boolean,
 availability text NOT NULL CHECK(availability IN ('in_stock','out_of_stock')),
 currency text NOT NULL DEFAULT 'EUR' CHECK(currency='EUR'),
 observed_at timestamptz NOT NULL CHECK(observed_at<='2100-01-01'::timestamptz),
 source_kind text NOT NULL DEFAULT 'manual' CHECK(source_kind='manual'),
 source_note text,
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(user_id,offer_id) REFERENCES public.radar_manual_offers(user_id,id) ON DELETE CASCADE,
 UNIQUE(user_id,id)
);
CREATE TABLE IF NOT EXISTS public.radar_watchlists (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 name text NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 60),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id,id), UNIQUE(user_id,name)
);
CREATE TABLE IF NOT EXISTS public.radar_watch_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 product_id uuid NOT NULL,
 watchlist_id uuid,
 status text NOT NULL DEFAULT 'manual_only' CHECK(status IN ('manual_only','paused_user')),
 target_cents bigint CHECK(target_cents>0),
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(user_id,product_id) REFERENCES public.radar_manual_products(user_id,id) ON DELETE CASCADE,
 FOREIGN KEY(user_id,watchlist_id) REFERENCES public.radar_watchlists(user_id,id) ON DELETE SET NULL (watchlist_id),
 UNIQUE(user_id,id), UNIQUE(user_id,id,product_id)
);
CREATE TABLE IF NOT EXISTS public.radar_alert_rules (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 product_id uuid NOT NULL,
 watch_item_id uuid NOT NULL,
 offer_id uuid NOT NULL,
 rule_type text NOT NULL CHECK(rule_type IN ('target','drop_eur','drop_pct')),
 threshold bigint NOT NULL CHECK(threshold>0),
 cooldown_hours integer NOT NULL DEFAULT 24 CHECK(cooldown_hours BETWEEN 0 AND 8760),
 enabled boolean NOT NULL DEFAULT true,
 last_condition_met boolean NOT NULL DEFAULT false,
 last_triggered_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(user_id,watch_item_id,product_id) REFERENCES public.radar_watch_items(user_id,id,product_id) ON DELETE CASCADE,
 FOREIGN KEY(user_id,offer_id,product_id) REFERENCES public.radar_manual_offers(user_id,id,product_id) ON DELETE CASCADE,
 UNIQUE(user_id,id)
);
CREATE TABLE IF NOT EXISTS public.radar_alert_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 rule_id uuid NOT NULL,
 offer_id uuid NOT NULL,
 observation_id uuid NOT NULL,
 triggered_total_cents bigint NOT NULL,
 event_key text NOT NULL UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(user_id,rule_id) REFERENCES public.radar_alert_rules(user_id,id) ON DELETE CASCADE,
 FOREIGN KEY(user_id,observation_id) REFERENCES public.radar_manual_observations(user_id,id) ON DELETE CASCADE,
 UNIQUE(user_id,id)
);
CREATE TABLE IF NOT EXISTS public.radar_notifications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 event_id uuid NOT NULL,
 channel text NOT NULL DEFAULT 'in_app' CHECK(channel='in_app'),
 created_at timestamptz NOT NULL DEFAULT now(),
 read_at timestamptz,
 FOREIGN KEY(user_id,event_id) REFERENCES public.radar_alert_events(user_id,id) ON DELETE CASCADE,
 UNIQUE(event_id,channel)
);

CREATE INDEX IF NOT EXISTS radar_manual_offers_user_product_idx ON public.radar_manual_offers(user_id,product_id);
CREATE INDEX IF NOT EXISTS radar_manual_observations_user_offer_date_idx ON public.radar_manual_observations(user_id,offer_id,observed_at DESC);
CREATE INDEX IF NOT EXISTS radar_watch_items_user_status_idx ON public.radar_watch_items(user_id,status);
CREATE INDEX IF NOT EXISTS radar_alert_rules_user_offer_idx ON public.radar_alert_rules(user_id,offer_id,enabled);
CREATE INDEX IF NOT EXISTS radar_notifications_unread_idx ON public.radar_notifications(user_id,read_at,created_at DESC);

-- All public tables deny access without ownership. Use explicit GRANT and RLS.
DO $$DECLARE tbl text; BEGIN
 FOREACH tbl IN ARRAY ARRAY['radar_profiles','radar_manual_products','radar_manual_offers','radar_manual_observations','radar_watchlists','radar_watch_items','radar_alert_rules','radar_alert_events','radar_notifications'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',tbl);
  EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated',tbl);
 END LOOP;
END$$;

-- User-owned, mutable tables: create/read/update/delete only user's own rows.
DO $$DECLARE tbl text; BEGIN
 FOREACH tbl IN ARRAY ARRAY['radar_profiles','radar_manual_products','radar_manual_offers','radar_watchlists','radar_watch_items','radar_alert_rules'] LOOP
  EXECUTE format('CREATE POLICY own_rows ON public.%I FOR ALL TO authenticated USING ((select auth.uid())=user_id) WITH CHECK ((select auth.uid())=user_id)',tbl);
  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated',tbl);
 END LOOP;
END$$;
-- Observations are append-only for the data API; price history cannot be edited silently.
CREATE POLICY manual_obs_read ON public.radar_manual_observations FOR SELECT TO authenticated USING ((select auth.uid())=user_id);
CREATE POLICY manual_obs_write ON public.radar_manual_observations FOR INSERT TO authenticated WITH CHECK ((select auth.uid())=user_id);
GRANT SELECT, INSERT ON public.radar_manual_observations TO authenticated;

-- Alert events are generated by server trigger only (not insertable by browser).
CREATE POLICY alert_events_read ON public.radar_alert_events FOR SELECT TO authenticated USING ((select auth.uid())=user_id);
GRANT SELECT ON public.radar_alert_events TO authenticated;
CREATE POLICY notifications_read ON public.radar_notifications FOR SELECT TO authenticated USING ((select auth.uid())=user_id);
CREATE POLICY notifications_mark_read ON public.radar_notifications FOR UPDATE TO authenticated USING ((select auth.uid())=user_id) WITH CHECK ((select auth.uid())=user_id);
GRANT SELECT, UPDATE(read_at) ON public.radar_notifications TO authenticated;

-- DB-side transition-based alerting: no false provider identity, no SMTP/Push.
CREATE OR REPLACE FUNCTION radar_internal.evaluate_manual_price()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
 r record;
 previous_record public.radar_manual_observations%ROWTYPE;
 current_total bigint;
 previous_total bigint;
 met boolean;
 should_send boolean;
 event_id uuid;
BEGIN
 -- Do not notify on backdated observations that precede the latest entry.
 IF EXISTS(SELECT 1 FROM public.radar_manual_observations old WHERE old.offer_id=NEW.offer_id AND old.user_id=NEW.user_id AND old.id<>NEW.id AND old.observed_at>NEW.observed_at) THEN RETURN NEW; END IF;
 SELECT * INTO previous_record FROM public.radar_manual_observations old WHERE old.offer_id=NEW.offer_id AND old.user_id=NEW.user_id AND old.id<>NEW.id AND old.observed_at<=NEW.observed_at ORDER BY old.observed_at DESC,old.created_at DESC LIMIT 1;
 current_total:=CASE WHEN NEW.shipping_cents IS NOT NULL AND NEW.taxes_included IS TRUE AND NEW.availability='in_stock' THEN NEW.price_cents+NEW.shipping_cents ELSE NULL END;
 previous_total:=CASE WHEN previous_record.shipping_cents IS NOT NULL AND previous_record.taxes_included IS TRUE AND previous_record.availability='in_stock' THEN previous_record.price_cents+previous_record.shipping_cents ELSE NULL END;
 FOR r IN
  SELECT ar.*, wi.status FROM public.radar_alert_rules ar
  JOIN public.radar_watch_items wi ON wi.id=ar.watch_item_id AND wi.user_id=ar.user_id
  WHERE ar.user_id=NEW.user_id AND ar.offer_id=NEW.offer_id
  ORDER BY ar.id FOR UPDATE OF ar
 LOOP
  IF NOT r.enabled OR r.status='paused_user' THEN CONTINUE; END IF;
  met:=false;
  IF r.rule_type='target' THEN met:=current_total IS NOT NULL AND current_total<=r.threshold;
  ELSIF r.rule_type='drop_eur' THEN met:=current_total IS NOT NULL AND previous_total IS NOT NULL AND previous_total-current_total>=r.threshold;
  ELSIF r.rule_type='drop_pct' THEN met:=current_total IS NOT NULL AND previous_total IS NOT NULL AND previous_total>0 AND (previous_total-current_total)*10000/previous_total>=r.threshold;
  END IF;
  should_send:=met AND NOT r.last_condition_met AND (r.last_triggered_at IS NULL OR now() >= r.last_triggered_at+make_interval(hours=>r.cooldown_hours));
  IF should_send THEN
   event_id:=NULL;
   INSERT INTO public.radar_alert_events(user_id,rule_id,offer_id,observation_id,triggered_total_cents,event_key)
   VALUES(NEW.user_id,r.id,NEW.offer_id,NEW.id,current_total,r.id::text || ':' || NEW.id::text)
   ON CONFLICT(event_key) DO NOTHING RETURNING id INTO event_id;
   IF event_id IS NOT NULL THEN
    INSERT INTO public.radar_notifications(user_id,event_id,channel) VALUES(NEW.user_id,event_id,'in_app') ON CONFLICT(event_id,channel) DO NOTHING;
   END IF;
  END IF;
  UPDATE public.radar_alert_rules SET last_condition_met=met,last_triggered_at=CASE WHEN should_send THEN now() ELSE r.last_triggered_at END WHERE id=r.id AND user_id=NEW.user_id;
 END LOOP;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION radar_internal.evaluate_manual_price() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER radar_after_manual_observation AFTER INSERT ON public.radar_manual_observations FOR EACH ROW EXECUTE FUNCTION radar_internal.evaluate_manual_price();
COMMIT;
