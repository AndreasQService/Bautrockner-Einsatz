-- 1. Bereinigen und Tabelle für den Gerätekatalog neu erstellen
drop table if exists device_catalog cascade;

create table device_catalog (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  geraetetyp text not null,       -- z.B. "Kondenstrockner"
  hersteller text not null,       -- z.B. "Corroventa"
  modell text not null,           -- z.B. "K3 mit Pumpe"
  anschlusswert numeric           -- z.B. 0.45 (in kWh)
);

-- RLS aktivieren
alter table device_catalog enable row level security;
drop policy if exists "Enable all access for anon" on device_catalog;
create policy "Enable all access for anon" on device_catalog for all using (true) with check (true);

-- 2. Spalte in 'devices' für Verknüpfung hinzufügen
alter table devices add column if not exists catalog_id uuid references device_catalog(id);
