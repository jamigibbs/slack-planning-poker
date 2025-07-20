// Supabase client setup
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

// Load env vars if not already loaded
if (!process.env.SUPABASE_URL) {
  dotenv.config();
}

// Create and export the Supabase client
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

module.exports = supabase;
