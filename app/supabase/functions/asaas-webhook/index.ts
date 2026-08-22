import { serve } from "https://deno.land/std@0.168.0/http/server.ts" 
serve(async (req) => new Response(JSON.stringify({ status: "ok" }), { headers: { "Content-Type": "application/json" } })) 
