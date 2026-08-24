const asArray = (value) => (Array.isArray(value) ? value : []);

const firstDefined = (...values) => values.find(value => value !== undefined && value !== null && value !== '');

const getPointLabel = point => firstDefined(
    point?.pointName,
    point?.mp,
    point?.point,
    point?.label,
    point?.id,
);

const getWallValue = point => firstDefined(
    point?.w_value,
    point?.w,
    point?.wand,
    point?.wall,
    point?.W,
);

const getFloorValue = point => firstDefined(
    point?.b_value,
    point?.b,
    point?.boden,
    point?.floor,
    point?.B,
);

const getMeasurementPoints = source => asArray(
    source?.measurements?.length ? source.measurements
        : source?.measurementPoints?.length ? source.measurementPoints
            : source?.points,
);

const getSettings = source => source?.globalSettings || source || {};

const getSketch = (room, source) => firstDefined(
    source?.canvasImage,
    source?.globalSettings?.canvasImage,
    room?.measurementData?.canvasImage,
    room?.canvasImage,
    room?.sketch,
);

const normalizeSeries = (room, source, seriesIndex) => {
    const settings = getSettings(source);
    const points = getMeasurementPoints(source);
    if (points.length === 0) return null;

    return {
        id: firstDefined(source?.id, `${room?.id || room?.name || 'room'}-${seriesIndex}`),
        date: firstDefined(settings?.date, source?.date, source?.measured_at),
        device: firstDefined(settings?.device, settings?.deviceName, source?.device),
        temperature: firstDefined(settings?.temperature, source?.temperature),
        humidity: firstDefined(settings?.humidity, source?.humidity),
        sketch: getSketch(room, source),
        rows: points.map((point, pointIndex) => ({
            id: firstDefined(point?.id, `${seriesIndex}-${pointIndex}`),
            point: getPointLabel(point),
            wall: getWallValue(point),
            floor: getFloorValue(point),
            notes: firstDefined(point?.notes, point?.note, point?.notizen),
        })),
    };
};

const roomSources = room => {
    const history = asArray(room?.measurementHistory).filter(entry => getMeasurementPoints(entry).length > 0);
    if (history.length > 0) {
        return [...history].sort((a, b) => {
            const aDate = new Date(firstDefined(a?.globalSettings?.date, a?.date, 0)).getTime() || 0;
            const bDate = new Date(firstDefined(b?.globalSettings?.date, b?.date, 0)).getTime() || 0;
            return aDate - bDate;
        });
    }

    if (getMeasurementPoints(room?.measurementData).length > 0) return [room.measurementData];

    const directPoints = getMeasurementPoints(room);
    return directPoints.length > 0 ? [{ ...room, measurements: directPoints }] : [];
};

export const buildMeasurementRooms = data => {
    const rooms = asArray(data?.measurementRooms).length > 0 ? data.measurementRooms : asArray(data?.rooms);

    return rooms.map((room, roomIndex) => {
        const series = roomSources(room)
            .map((source, seriesIndex) => normalizeSeries(room, source, seriesIndex))
            .filter(Boolean);

        return {
            id: firstDefined(room?.id, `room-${roomIndex}`),
            name: firstDefined(room?.name, room?.roomName, `Raum ${roomIndex + 1}`),
            apartment: firstDefined(room?.apartment, room?.wohnung),
            floor: firstDefined(room?.stockwerk, room?.floor),
            series,
        };
    }).filter(room => room.series.length > 0);
};

export const chunkMeasurementRows = (rows, size = 10) => {
    const safeSize = Number.isInteger(size) && size > 0 ? size : 10;
    const chunks = [];
    for (let index = 0; index < rows.length; index += safeSize) {
        chunks.push(rows.slice(index, index + safeSize));
    }
    return chunks;
};
