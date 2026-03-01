# Deploying the Gemini Extraction Function

Since we switched to **Google Gemini (1.5-Flash)**, you need to deploy the refined Edge Function to your Supabase project.

## Prerequisites
1.  **Supabase CLI**: Install it via `npm install -g supabase`.
2.  **Login**: Run `npx supabase login` to authenticate with your Supabase account.
3.  **Project ID**: You might need to link your local folder to your Supabase project if not done yet: `npx supabase link --project-ref yxdoecdqttgdncgbzyus`.

## Deployment Steps

### 1. Set the Gemini API Key
The function requires a valid Google Gemini API Key. Go to your **Supabase Dashboard** (see your screenshot!) -> **Edge Functions** -> **extract** -> **Settings/Secrets**, or run:
```bash
npx supabase secrets set GOOGLE_API_KEY=AIzaSy...your-gemini-key...
```

### 2. Deploy the Function
Run this command from the `c:\QTool` root directory:
```bash
npx supabase functions deploy extract
```
*Tip: If you want to allow anonymous calls for testing (matching our 'anon' RLS policies), you can add `--no-verify-jwt`.*

## Verification
1.  **Dashboard**: Check the "Edge Functions" section in your [Supabase Dashboard](https://supabase.com/dashboard/project/yxdoecdqttgdncgbzyus/functions).
2.  **Logs**: Once an upload is triggered from the app, you can see the Gemini analysis results and potential errors in the "Logs" tab of the `extract` function.
3.  **App**: Drag a PDF or MSG into the `UploadPanel`—it should now say "⏳ Analysiere (Edge Function)...".

---

## Important Note on Local Testing
If you want to test the Edge Function locally before deploying:
```bash
npx supabase start
npx supabase functions serve extract --no-verify-jwt
```
This will run the function locally on `localhost:54321`.
