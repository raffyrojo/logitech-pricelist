/* ============================================================
   Logitech Pricelist CMS — configuration
   The ONLY file you normally need to edit.
   ============================================================ */
window.CMS_CONFIG = {
  // GitHub repository that hosts the site + data (owner/name)
  githubRepo: "raffyrojo/logitech-pricelist",

  // Branch GitHub Pages serves from
  branch: "main",

  // Secure backend (Cloudflare Worker) that commits products.json.
  // Leave empty until Phase 5; admin Save falls back to local download.
  backendEndpoint: "",

  // Relative paths to data files (usually leave as-is)
  paths: {
    products:   "data/products.json",
    categories: "data/categories.json",
    settings:   "data/settings.json",
    images:     "images/"
  }
};
