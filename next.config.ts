import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve("."),
  },
  async redirects() {
    return [
      { source: '/historique', destination: '/vigiprix/historique', permanent: false },
      { source: '/produits', destination: '/vigiprix/produits', permanent: false },
      { source: '/produit/:path*', destination: '/vigiprix/produit/:path*', permanent: false },
      { source: '/rayon/:path*', destination: '/vigiprix/rayon/:path*', permanent: false },
      { source: '/import', destination: '/vigiprix/import', permanent: false },
      { source: '/import-produits', destination: '/vigiprix/import-produits', permanent: false },
      { source: '/activites', destination: '/vigiprix/activites', permanent: false },
      { source: '/support', destination: '/vigiprix/support', permanent: false },
      { source: '/parametres/:path*', destination: '/vigiprix/parametres/:path*', permanent: false },
    ];
  },
};

export default nextConfig;
