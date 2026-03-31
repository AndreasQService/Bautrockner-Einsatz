/**
 * Konvertiert lat/lng in OSM-Tile-Koordinaten.
 */
function latLngToTile(lat, lng, zoom) {
    const n = Math.pow(2, zoom);
    const x = Math.floor((lng + 180) / 360 * n);
    const y = Math.floor(
        (1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * n
    );
    return { x, y };
}

/**
 * Geocodiert eine Adresse via Nominatim (Proxy).
 * Gibt { lat, lng } zurück oder null bei Fehler.
 */
export async function geocodeAddress(query) {
    try {
        const url = `/nominatim/search?q=${encodeURIComponent(query + ', Schweiz')}&format=json&limit=1`;
        console.log('[MapService] Geocoding:', url);
        const resp = await fetch(url, { headers: { 'Accept-Language': 'de' } });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const results = await resp.json();
        if (!results || results.length === 0) {
            console.warn('[MapService] Keine Geocoding-Ergebnisse für:', query);
            return null;
        }
        const coords = { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) };
        console.log('[MapService] Koordinaten:', coords);
        return coords;
    } catch (e) {
        console.warn('[MapService] Geocoding fehlgeschlagen:', e.message);
        return null;
    }
}

/**
 * Lädt CartoDB Voyager Tiles via Proxy und zeichnet sie auf Canvas.
 * Tiles werden als Blobs per fetch() geladen → kein Canvas CORS-Taint.
 */
export async function getMapDataUrl({ lat, lng }) {
    try {
        const zoom = 16;
        const TILES = 3;
        const TILE_PX = 256;
        const { x: tileX, y: tileY } = latLngToTile(lat, lng, zoom);
        const offset = Math.floor(TILES / 2);

        const canvas = document.createElement('canvas');
        canvas.width = TILE_PX * TILES;
        canvas.height = TILE_PX * TILES;
        const ctx = canvas.getContext('2d');

        // Tiles als Blobs laden (kein CORS-Taint-Problem)
        const tilePromises = [];
        for (let dy = -offset; dy <= offset; dy++) {
            for (let dx = -offset; dx <= offset; dx++) {
                const tx = tileX + dx;
                const ty = tileY + dy;
                const url = `/carto-tile/rastertiles/voyager/${zoom}/${tx}/${ty}.png`;
                const drawX = (dx + offset) * TILE_PX;
                const drawY = (dy + offset) * TILE_PX;

                tilePromises.push((async () => {
                    try {
                        const resp = await fetch(url);
                        const ct = resp.headers.get('content-type') || '';
                        if (!resp.ok || !ct.startsWith('image/')) {
                            const txt = await resp.text();
                            console.error('[MapService] Kein Bild zurückgegeben:', resp.status, ct, txt.substring(0, 200));
                            return;
                        }
                        const blob = await resp.blob();
                        const objUrl = URL.createObjectURL(blob);
                        await new Promise((resolve) => {
                            const img = new window.Image();
                            img.onload = () => {
                                ctx.drawImage(img, drawX, drawY, TILE_PX, TILE_PX);
                                URL.revokeObjectURL(objUrl);
                                resolve();
                            };
                            img.onerror = () => {
                                URL.revokeObjectURL(objUrl);
                                resolve();
                            };
                            img.src = objUrl;
                        });
                    } catch (e) {
                        console.warn('[MapService] Tile-Fehler:', url, e.message);
                    }
                })());
            }
        }
        await Promise.all(tilePromises);

        // Roter Pin in der Mitte
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        ctx.beginPath();
        ctx.arc(cx, cy - 12, 10, 0, 2 * Math.PI);
        ctx.fillStyle = '#e53e3e';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx - 7, cy - 12);
        ctx.lineTo(cx + 7, cy - 12);
        ctx.closePath();
        ctx.fillStyle = '#e53e3e';
        ctx.fill();

        const dataUrl = canvas.toDataURL('image/png');
        console.log('[MapService] Karte generiert, Länge:', dataUrl.length);
        return dataUrl;
    } catch (e) {
        console.error('[MapService] Kartengenerierung fehlgeschlagen:', e.message);
        return null;
    }
}
