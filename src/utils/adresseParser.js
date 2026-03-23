/**
 * parseAdresse – parst eine kombinierte Adresszeile in einzelne Felder.
 *
 * Unterstützte Formate:
 *   "Speerstrasse 12, 8004 Zürich"
 *   "Hauptstrasse 5 9000 St. Gallen"
 *   "8004 Zürich"          → nur PLZ + Ort
 *   "Speerstrasse 12"      → nur Strasse
 */
export function parseAdresse(input) {
  if (!input) return {};

  const str = input.trim();

  // Format: "[Strasse], PLZ Ort"  oder  "[Strasse] PLZ Ort"
  const full = str.match(/^(.+?),?\s*(\d{4})\s+(.+)$/);
  if (full) {
    return {
      strasse: full[1].trim(),
      plz: full[2],
      ort: full[3].trim(),
    };
  }

  // Nur PLZ + Ort: "8004 Zürich"
  const plzOrt = str.match(/^(\d{4})\s+(.+)$/);
  if (plzOrt) {
    return {
      strasse: '',
      plz: plzOrt[1],
      ort: plzOrt[2].trim(),
    };
  }

  // Fallback: alles in Strasse
  return { strasse: str, plz: '', ort: '' };
}

/**
 * splitPlzOrt – einfacher Split wenn nur PLZ+Ort ohne Strasse vorliegt.
 * Wrapper um parseAdresse für Rückwärtskompatibilität.
 */
export function splitPlzOrt(value = '') {
  const { plz, ort } = parseAdresse(value);
  return { plz, ort };
}

/**
 * normalizeImportData – bringt BEIDE Import-Strukturen (neuer Prompt + alter V2-Prompt)
 * in eine einzige kanonische Form.
 *
 * Danach lesen Karte UND Formular aus demselben Objekt.
 *
 * Kanonische Felder:
 *   auftraggeber: { firma, name, rolle, telefon, email, strasse_nr, plz, ort }
 *   schadenort:   { bezeichnung, strasse_nr, plz, ort }
 */
export function normalizeImportData(data) {
  if (!data) return data;

  // Alte V2-Felder (EmailImportModalV2)
  const av = data.auftrag_verwaltung || {};
  const rd = data.rechnungs_details  || {};

  // PLZ/Ort splitten falls noch kombiniert
  const agSplit = splitPlzOrt(data.auftraggeber?.plz_ort || av.plz_ort || '');
  const soSplit = splitPlzOrt(data.schadenort?.plz_ort  || '');

  return {
    ...data,
    auftraggeber: {
      firma:      data.auftraggeber?.firma      || av.firma            || '',
      name:       data.auftraggeber?.name       || av.sachbearbeiter   || '',
      rolle:      data.auftraggeber?.rolle      || av.rolle            || 'Verw.',
      telefon:    data.auftraggeber?.telefon    || av.telefon          || '',
      email:      data.auftraggeber?.email      || av.email            || '',
      strasse_nr: data.auftraggeber?.strasse_nr || av.adresse          || '',
      plz:        data.auftraggeber?.plz        || av.plz              || agSplit.plz,
      ort:        data.auftraggeber?.ort        || av.ort              || agSplit.ort,
    },
    schadenort: {
      bezeichnung: data.schadenort?.bezeichnung || data.schadenort?.etage_wohnung || '',
      strasse_nr:  data.schadenort?.strasse_nr  || '',
      plz:         data.schadenort?.plz         || soSplit.plz,
      ort:         data.schadenort?.ort         || soSplit.ort,
    },
    // Alte Kontakte für Fallback erhalten
    _kontakte: data.kontakte || [],
    projekt_daten:     data.projekt_daten     || {},
    rechnungs_details: rd,
    verwaltung:  data.verwaltung  || { firma: '', name: '', rolle: 'Verw.', telefon: '', email: '' },
    eigentuemer: data.eigentuemer || { firma: rd.eigentuemer || '', name: '', rolle: 'Eig.', telefon: '', email: rd.email_rechnung || '' },
    hauswart:    data.hauswart    || { firma: '', name: '', rolle: 'HW',    telefon: '', email: '' },
    mieter:     Array.isArray(data.mieter)     ? data.mieter     : [],
    handwerker: Array.isArray(data.handwerker) ? data.handwerker : [],
    schaden: data.schaden || { art: av.leistungsart || 'Wasserschaden', beschreibung: '' },
  };
}
