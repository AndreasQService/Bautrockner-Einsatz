// api/google-staticmap.js
export default async function handler(req, res) {
  // CORS-Header setzen, damit die Client-App das Bild per fetch laden und konvertieren darf
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY || 
                   process.env.VITE_GOOGLE_MAPS_API_KEY || 
                   process.env.VITE_GOOGLE_API_KEY;

    if (!apiKey) {
      console.error('[google-staticmap proxy] ERROR: No Google Maps API Key found in environment variables!');
      res.status(500).json({ 
        error: 'Server configuration error', 
        details: 'GOOGLE_MAPS_API_KEY environment variable is missing in Vercel settings. Please configure it in Vercel Dashboard -> Settings -> Environment Variables.' 
      });
      return;
    }

    const params = new URLSearchParams();

    // Nur erlaubte Parameter kopieren (key wird ignoriert/entfernt)
    const allowedKeys = [
      'center', 'zoom', 'size', 'scale', 'maptype', 
      'format', 'language', 'region'
    ];

    allowedKeys.forEach(k => {
      if (req.query[k] !== undefined) {
        params.set(k, String(req.query[k]));
      }
    });

    // markers Parameter speziell behandeln, falls es mehrere gibt
    if (req.query.markers !== undefined) {
      if (Array.isArray(req.query.markers)) {
        req.query.markers.forEach(m => {
          params.append('markers', String(m));
        });
      } else {
        params.append('markers', String(req.query.markers));
      }
    }

    // Server-seitigen Key hinzufügen
    params.set('key', apiKey);

    const googleUrl = `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;

    // Forward the client's Referer header or fallback to host to satisfy Google's HTTP Referrer restrictions
    const referer = req.headers.referer || `https://${req.headers.host}/` || 'https://bautrockner-einsatz.vercel.app/';
    
    console.log(`[google-staticmap proxy] Fetching map for center="${req.query.center}" zoom="${req.query.zoom}" using referer="${referer}"`);

    const googleResponse = await fetch(googleUrl, {
      headers: {
        'Referer': referer
      }
    });
    if (!googleResponse.ok) {
      const errText = await googleResponse.text().catch(() => 'No details');
      console.error(`[google-staticmap proxy] Google API returned status ${googleResponse.status}: ${errText}`);
      res.status(googleResponse.status).json({ 
        error: 'Map fetching failed', 
        status: googleResponse.status, 
        details: errText 
      });
      return;
    }

    const buffer = await googleResponse.arrayBuffer();
    const contentType = googleResponse.headers.get('content-type') || 'image/png';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.status(200).send(Buffer.from(buffer));
  } catch (error) {
    console.error('[google-staticmap proxy] Critical handler error:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}
