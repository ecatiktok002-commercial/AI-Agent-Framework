/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

let supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
let supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validate URL
try {
  if (supabaseUrl) {
    new URL(supabaseUrl);
  } else {
    console.error('VITE_SUPABASE_URL is missing or empty.');
  }
} catch (e) {
  console.error('Invalid VITE_SUPABASE_URL provided.');
}

if (!supabaseAnonKey || supabaseAnonKey.trim() === '') {
  console.error('VITE_SUPABASE_ANON_KEY is missing or empty.');
}

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase credentials missing. Please check your environment variables.');
}

console.log('Initializing Supabase client with URL:', supabaseUrl);

if (supabaseUrl && supabaseUrl.includes('localhost')) {
  console.error('WARNING: You are trying to connect to a localhost Supabase instance from AI Studio. This will not work because AI Studio runs in a remote container. Please use a remote Supabase URL (e.g., https://xxx.supabase.co).');
}

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);
