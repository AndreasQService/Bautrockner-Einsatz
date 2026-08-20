export const NEW_DEVICE_TYPE_VALUE = '__new_device_type__';

export const normalizeRentalNumber = (value) => String(value || '').trim().toLocaleUpperCase('de-CH');

export const isRentalTypeSelectionValid = ({ catalogId, newTypeName }) => (
    Boolean(String(catalogId || '').trim()) || Boolean(String(newTypeName || '').trim())
);

export async function createRentalDeviceAssignment({
    supabase,
    reportId,
    deviceNumber,
    catalogId,
    newTypeName,
    startDate,
    apartment,
    room,
    counterStart,
    runtimeHours
}) {
    if (!supabase) throw new Error('Datenbankverbindung fehlt.');
    const normalizedNumber = normalizeRentalNumber(deviceNumber);
    if (!normalizedNumber) throw new Error('Bitte eine Mietgeräte-Nummer eingeben.');
    if (!reportId) throw new Error('Das Projekt hat noch keine bestätigte Datenbank-ID.');
    if (!isRentalTypeSelectionValid({ catalogId, newTypeName })) {
        throw new Error('Bitte einen Gerätetyp wählen oder neu erfassen.');
    }

    const { data, error } = await supabase.rpc('create_rental_device_assignment', {
        p_report_id: String(reportId),
        p_device_number: normalizedNumber,
        p_catalog_id: catalogId || null,
        p_new_type_name: String(newTypeName || '').trim() || null,
        p_start_date: startDate || null,
        p_apartment: String(apartment || '').trim() || null,
        p_room: String(room || '').trim() || null,
        p_counter_start: String(counterStart ?? '').trim() || null,
        p_runtime_hours: String(runtimeHours ?? '').trim() || null
    });
    if (error) {
        if (error.code === '23505' || /RENTAL_NUMBER_ALREADY_ACTIVE/i.test(error.message || '')) {
            throw new Error(`Die Mietgeräte-Nummer "${normalizedNumber}" ist bereits aktiv vergeben.`);
        }
        throw error;
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.rental_device_id || !row?.catalog_id || !row?.device_type) {
        throw new Error('Die Datenbank hat die Mietgeräte-Zuweisung nicht vollständig bestätigt.');
    }
    return row;
}

export async function endRentalDeviceAssignment({
    supabase,
    rentalDeviceId,
    reportId,
    endDate,
    runtimeHours
}) {
    if (!supabase) throw new Error('Datenbankverbindung fehlt.');
    if (!rentalDeviceId || !reportId) throw new Error('Die Mietgeräte-Zuweisung ist nicht vollständig verknüpft.');
    if (!endDate) throw new Error('Bitte ein Enddatum eingeben.');

    const { data, error } = await supabase
        .from('rental_devices')
        .update({
            end_date: endDate,
            runtime_hours: String(runtimeHours ?? '').trim() || null
        })
        .eq('id', rentalDeviceId)
        .eq('report_id', String(reportId))
        .is('end_date', null)
        .select('id, report_id, end_date, runtime_hours')
        .maybeSingle();

    if (error) throw error;
    if (!data?.id || data.report_id !== String(reportId) || data.end_date !== endDate) {
        throw new Error('Die Datenbank hat die Abmeldung des Mietgeräts nicht bestätigt.');
    }
    return data;
}
