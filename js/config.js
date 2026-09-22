window.HR_CONFIG = {
  SUPABASE_URL: "https://bzkroswxcbawgjtixtow.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_tnZ9MdAiRRbr8KuKS-rWeg_Q3xcfVgn",
  SITE_URL: window.location.origin
};

(function () {
  function initSupabase() {
    if (!window.supabase) {
      console.error(
        "Holy Rosary: Supabase library has not loaded yet."
      );
      return false;
    }

    if (
      !window.HR_CONFIG.SUPABASE_URL ||
      window.HR_CONFIG.SUPABASE_URL.includes("YOUR-PROJECT")
    ) {
      console.error(
        "Holy Rosary: Supabase URL is not configured."
      );
      return false;
    }

    try {
      window.hrSupabase =
        window.supabase.createClient(
          window.HR_CONFIG.SUPABASE_URL,
          window.HR_CONFIG.SUPABASE_ANON_KEY
        );

      console.log(
        "Holy Rosary: Supabase client initialized."
      );

      return true;

    } catch (error) {
      console.error(
        "Holy Rosary: Failed to initialize Supabase client.",
        error
      );

      return false;
    }
  }

  window.hrSupabase = null;

  /*
   * Supabase is normally loaded before this file.
   * This also protects against delayed CDN loading.
   */
  if (!initSupabase()) {
    window.addEventListener(
      "load",
      () => {
        if (!window.hrSupabase) {
          initSupabase();
        }
      },
      { once: true }
    );
  }
})();