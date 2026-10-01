// Reuse the cookie-aware browser client so data requests carry the same
// authenticated session that the login flow and middleware establish.
import { createClient } from '@/app/utils/supabase/client';

export const supabase = createClient();
