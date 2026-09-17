// Import Supabase SDK
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ⚠️ GANTI DENGAN PUNYA KAMU (dari langkah 1.5)
const SUPABASE_URL = "https://tzngfmqxrmuorjlexdlf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR6bmdmbXF4cm11b3JqbGV4ZGxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk1ODIzOTMsImV4cCI6MjEwNTE1ODM5M30.z614NyI9p3xxwoXMVjK7eqz32_Kwqyh7fKPB95c-VHw";

// Initialize Supabase Client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export { supabase };