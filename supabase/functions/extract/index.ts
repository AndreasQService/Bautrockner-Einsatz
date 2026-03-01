import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { Buffer } from "https://deno.land/std@0.168.0/node/buffer.ts";
import pdfParse from "https://esm.sh/pdf-parse@1.1.1";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { document_id } = await req.json()
        if (!document_id) throw new Error("Missing document_id")

        // 1. Setup Supabase Client
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        const googleApiKey = Deno.env.get('GOOGLE_API_KEY') ?? ''

        if (!googleApiKey) {
            throw new Error("GOOGLE_API_KEY is not set in Secrets")
        }

        const supabase = createClient(supabaseUrl, supabaseKey)

        // 2. Fetch Document Info
        const { data: doc, error: docError } = await supabase
            .from("case_documents")
            .select("*")
            .eq("id", document_id)
            .single()

        if (docError || !doc) throw new Error("Document not found")

        // 3. Download File from Storage
        const { data: fileData, error: downloadError } = await supabase
            .storage
            .from("case-files")
            .download(doc.file_path)

        if (downloadError) throw downloadError

        // 4. Extract Text content
        let textContent = "";

        // Einfache Text-Extraktion für .txt, .pdf und .msg
        if (doc.file_type === 'txt' || doc.file_path.endsWith('.txt')) {
            textContent = await fileData.text();

        } else if (doc.file_type === 'pdf' || doc.file_path.toLowerCase().endsWith('.pdf')) {
            try {
                console.log("Parsing PDF...");
                const arrayBuffer = await fileData.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                const pdfData = await pdfParse(buffer);
                textContent = pdfData.text;
                console.log("PDF Parsed successfully.");
            } catch (e) {
                console.error("PDF Parse Error:", e);
                textContent = "[[Error parsing PDF file. Only metadata available.]]";
            }

        } else if (doc.file_type === 'msg' || doc.file_path.toLowerCase().endsWith('.msg')) {
            // MSG fallback extraction (Extract readable strings)
            try {
                console.log("Parsing MSG (Fallback)...");
                const arrayBuffer = await fileData.arrayBuffer();
                // Simple regex to extract printable chars > 4 length
                const decoder = new TextDecoder('utf-8'); // Try utf-8 first
                const rawText = decoder.decode(arrayBuffer);

                // Filter for printable sequences to avoid binary garbage
                // This is a naive heuristic but works well for extracting body text from MSGs
                textContent = rawText.replace(/[^\x20-\x7E\xA0-\xFF\n\r\t]/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim();

                if (textContent.length < 50) {
                    // If UTF-8 failed (binary MSG), try pure ASCII regex on the buffer directly
                    const buffer = Buffer.from(arrayBuffer);
                    const ascii = buffer.toString('binary').replace(/[^\x20-\x7E\n\r\t]/g, ' ');
                    textContent = ascii.replace(/\s+/g, ' ').trim();
                }
                console.log("MSG Parsed (Fallback).");
            } catch (e) {
                console.error("MSG Parse Error:", e);
                textContent = "[[Error parsing MSG file.]]";
            }
        } else {
            textContent = "[[Unsupported File Type]]";
        }

        console.log("Extracted text length:", textContent.length);
        console.log("Text preview:", textContent.slice(0, 100));

        // 5. Call Gemini AI
        const systemPrompt = `Du bist ein technischer Daten-Parser für die AG-App (Q-Service). Deine Aufgabe ist es, unstrukturierte Texte (E-Mails, PDF-Inhalte) in ein exaktes JSON-Format zu überführen.

1. REGEL FÜR ADRESS-SPLIT (PFLICHT):
   - FELD 'EIGENTÜMER': Suche nach dem Namen der Organisation oder Person.
   - CUT-OFF: Sobald ein Wort erscheint, das eine Adresse einleitet (Strasse, Str., Weg, PLZ, Ort), muss dieses Wort und alles danach aus dem Feld 'EIGENTÜMER' entfernt werden.
   - MAPPING: Diese entfernten Teile müssen in 'strasse_nr' und 'plz_ort' des Schadenorts geschrieben werden.

2. ROLLEN-LOGIK (NUR DIESE WERTE):
   Ordne jedem Kontakt ausschliesslich eines dieser Kürzel zu:
   - 'Handw.': Firmen, Techniker, Sanitär.
   - 'Verw.': Verwaltungen, Bewirtschaftungen.
   - 'Mieter': Bewohner des Objekts.
   - 'Eig.': Der Eigentümer (wie oben extrahiert).
   - 'HW': Hauswart.

3. VERBOT VON PLATZHALTERN:
   - Gib niemals das Wort "string" oder ähnliche Platzhalter aus.
   - Falls eine Information nicht existiert, gib einen leeren String ("") aus.

4. FORMATIERUNG:
   - Telefon: +41 XX XXX XX XX (wo möglich).

AUSGABE-FORMAT (JSON):
{
  "projekt_daten": { "interne_id": "", "externe_ref": "", "auftrags_nr": "" },
  "auftrag_verwaltung": { "firma": "", "sachbearbeiter": "", "leistungsart": "" },
  "rechnungs_details": { "eigentuemer": "", "email_rechnung": "", "vermerk": "" },
  "schadenort": { "strasse_nr": "", "plz_ort": "", "etage_wohnung": "" },
  "kontakte": [ { "name": "", "rolle": "Handw.|Verw.|Mieter|Eig.|HW", "telefon": "" } ],
  "gap_analysis": []
}

Antworte NUR mit dem validen JSON-Code OHNE Markdown-Formatierung.`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${googleApiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: systemPrompt },
                        { text: `HIER IST DER TEXT ZUR ANALYSE:\n\n${textContent}` }
                    ]
                }],
                generationConfig: {
                    temperature: 0.1,
                    responseMimeType: "application/json"
                }
            })
        });

        const resData = await response.json();
        if (resData.error) throw new Error("Gemini API Error: " + resData.error.message);

        const aiResult = JSON.parse(resData.candidates[0].content.parts[0].text.trim());


        // 6. Save Extraction to DB
        const { error: insertError } = await supabase
            .from("case_extractions")
            .insert({
                case_id: doc.case_id,
                json_result: aiResult,
                confidence: { score: 1.0 }, // Dummy Score
                evidence: { document_id: document_id }
            });

        if (insertError) throw insertError;

        // 7. Update Document Status
        await supabase
            .from("case_documents")
            .update({ extraction_status: "completed" })
            .eq("id", document_id);

        // Return result to client
        return new Response(
            JSON.stringify({ success: true, data: aiResult }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )

    } catch (error) {
        console.error(error)
        return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        )
    }
})
