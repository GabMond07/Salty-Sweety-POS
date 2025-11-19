import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://evwqoupirrcarjqscngv.supabase.co"; // Reemplaza con la tuya
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV2d3FvdXBpcnJjYXJqcXNjbmd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyNTU2OTAsImV4cCI6MjA3ODgzMTY5MH0.pb0DY97yEWq_dvew0N5a3XInAF_xhDxO0E0uxa83t8w";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
