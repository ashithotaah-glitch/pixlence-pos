export default function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ ok: false, message: "Method not allowed" });
  }

  const supabaseUrl = process.env.SUPABASE_URL || "";
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || "";

  return response.status(200).json({
    ok: true,
    supabase: supabaseUrl && publishableKey
      ? {
          url: supabaseUrl,
          publishableKey,
          configured: true,
          jwksConfigured: Boolean(process.env.SUPABASE_JWKS_URL),
          secretConfigured: Boolean(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)
        }
      : {
          configured: false
        }
  });
}
