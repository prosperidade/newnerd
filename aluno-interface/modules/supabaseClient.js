/*
 * SupabaseClient module
 *
 * This module centralises the initialisation of a Supabase client and
 * exposes a small API for authentication and database operations. The
 * configuration is injected via a global CONFIG object or environment
 * variables, keeping secrets out of source code. In a production build
 * these values should be supplied at build time (e.g. via Vite/webpack
 * define plugin or dotenv) and not hard‑coded.
 */

// Expect `@supabase/supabase-js` to be available globally from a CDN. If you
// bundle this code with a build system you can replace the global import
// with `import { createClient } from '@supabase/supabase-js'`.
const { createClient } = window.supabase;

/**
 * Create a Supabase client using configuration found on the global CONFIG
 * object. Throws if configuration is missing.
 *
 * Example CONFIG:
 * {
 *   SUPABASE: { url: 'https://xyz.supabase.co', anonKey: 'public‑key' }
 * }
 */
class SupabaseClientWrapper {
  constructor(config) {
    if (!config || !config.url || !config.anonKey) {
      throw new Error('Supabase configuration missing – ensure CONFIG.SUPABASE.url and anonKey are defined');
    }
    this.client = createClient(config.url, config.anonKey);
  }

  /**
   * Get the current authentication session. Returns a Promise that
   * resolves to `{ data: { session }, error }` like the standard
   * Supabase client.
   */
  getSession() {
    return this.client.auth.getSession();
  }

  /**
   * Sign in a user with email and password. Returns an object with
   * session information or error. Do not store passwords or API keys
   * on the client; always send them over HTTPS.
   */
  signInWithEmail({ email, password }) {
    return this.client.auth.signInWithPassword({ email, password });
  }

  /**
   * Sign out the current user.
   */
  signOut() {
    return this.client.auth.signOut();
  }

  /**
   * Query a table. Accepts the table name and optional filters. Returns
   * a Supabase query builder so you can chain `.select()`, `.insert()`,
   * `.update()`, `.delete()` etc. This method is a thin wrapper around
   * `supabase.from(table)` to promote encapsulation.
   */
  from(table) {
    return this.client.from(table);
  }

  /**
   * Call a stored procedure (RPC) in the database. Useful for custom
   * logic such as semantic search or complex queries.
   */
  rpc(fnName, args) {
    return this.client.rpc(fnName, args);
  }
}

// Initialise a single instance using global configuration when the module
// is loaded. In your HTML you should define `window.CONFIG.SUPABASE`.
const supa = new SupabaseClientWrapper(window.CONFIG?.SUPABASE ?? {});

export default supa;