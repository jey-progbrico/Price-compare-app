ALTER TABLE public.produits ADD COLUMN IF NOT EXISTS reference_fabricant VARCHAR(255);
ALTER TABLE public.produits ADD COLUMN IF NOT EXISTS categorie VARCHAR(255);
