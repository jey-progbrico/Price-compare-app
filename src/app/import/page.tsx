"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Package, ExternalLink, Save, Zap, HelpCircle } from "lucide-react";
import Link from "next/link";

function ImportForm() {
  const searchParams = useSearchParams();
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [ean, setEan] = useState("");
  const [prix, setPrix] = useState("");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const urlParam = searchParams.get("url");
    const titleParam = searchParams.get("title");
    const eanParam = searchParams.get("ean");
    
    if (urlParam) setUrl(urlParam);
    if (titleParam) setTitle(titleParam);
    
    // Restaurer l'EAN : priorité à l'URL, puis au localStorage (EAN courant)
    if (eanParam) {
      setEan(eanParam);
    } else {
      const storedEan = localStorage.getItem("vigi_current_ean");
      if (storedEan) {
        setEan(storedEan);
        console.log(`[IMPORT] EAN restauré depuis le contexte : ${storedEan}`);
      }
    }
  }, [searchParams]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ean || !prix) return;
    setLoading(true);

    try {
      // Déduction simple de l'enseigne depuis l'URL
      let enseigne = "Autre";
      try {
        const domain = new URL(url).hostname.replace('www.', '');
        enseigne = domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1);
        if (domain.includes("leroymerlin")) enseigne = "Leroy Merlin";
        if (domain.includes("bricodepot")) enseigne = "Brico Dépôt";
        if (domain.includes("manomano")) enseigne = "ManoMano";
      } catch (e) {}

      const response = await fetch("/api/releves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ean,
          enseigne,
          url,
          prix_constate: prix,
          designation_originale: title
        }),
      });

      if (response.ok) {
        setSaved(true);
        setTimeout(() => {
          window.location.href = `/produit/${ean}`;
        }, 1500);
      }
    } catch (err) {
      console.error("Erreur import:", err);
      alert("Erreur lors de l'enregistrement.");
    } finally {
      setLoading(false);
    }
  };

  const bookmarkletCode = `javascript:(function(){
    var ean = document.body.innerText.match(/\\b\\d{13}\\b/)?.[0] || '';
    var url = encodeURIComponent(location.href);
    var title = encodeURIComponent(document.title);
    window.open('${typeof window !== 'undefined' ? window.location.origin : ''}/import?ean='+ean+'&url='+url+'&title='+title, '_blank');
  })();`;

  return (
    <div className="max-w-md mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-red-600/20">
          <Zap className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white leading-tight">Import Rapide</h1>
          <p className="text-xs text-neutral-500 font-medium">Enregistrez un lien concurrent en un clic</p>
        </div>
      </div>

      {saved ? (
        <div className="p-8 bg-emerald-950/20 border border-emerald-500/30 rounded-3xl text-center space-y-4 animate-in zoom-in-95 duration-300">
          <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
            <Save className="w-8 h-8 text-white" />
          </div>
          <p className="text-emerald-400 font-bold">Relevé enregistré !</p>
          <p className="text-neutral-500 text-xs">Redirection vers la fiche produit...</p>
        </div>
      ) : (
        <form onSubmit={handleSave} className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-2xl space-y-5">
          {/* URL Preview */}
          <div className="p-3 bg-black/40 rounded-xl border border-neutral-800/50">
            <div className="flex items-center gap-2 mb-1">
              <ExternalLink className="w-3 h-3 text-neutral-500" />
              <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Lien à importer</span>
            </div>
            <p className="text-[11px] text-red-500 font-mono truncate">{url || "Aucune URL détectée"}</p>
            <p className="text-xs text-white font-bold mt-1 line-clamp-1">{title || "Sans titre"}</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider mb-1.5 block px-1">EAN du produit</label>
              <input
                type="text"
                required
                placeholder="Ex: 3414970810151"
                value={ean}
                onChange={(e) => setEan(e.target.value)}
                className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3.5 text-sm text-white focus:border-red-600 focus:ring-1 focus:ring-red-600 outline-none transition-all font-mono"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider mb-1.5 block px-1">Prix constaté (€)</label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="Ex: 45.90"
                value={prix}
                onChange={(e) => setPrix(e.target.value)}
                className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3.5 text-lg text-white font-black focus:border-red-600 focus:ring-1 focus:ring-red-600 outline-none transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !ean || !prix}
            className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-red-600/20 disabled:opacity-30 flex items-center justify-center gap-2"
          >
            {loading ? <Zap className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            Enregistrer le relevé
          </button>
        </form>
      )}

      {/* Bookmarklet Help */}
      <div className="bg-neutral-950 border border-neutral-900 rounded-3xl p-6 space-y-6">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-blue-400" />
          <h2 className="text-sm font-bold text-white">Installation du Bookmarklet</h2>
        </div>

        <div className="space-y-4 text-xs text-neutral-400 leading-relaxed">
          <p>
            Pour importer une page d'un seul clic, créez un favori dans votre navigateur et utilisez le code ci-dessous comme adresse (URL) :
          </p>

          <div className="relative group">
            <pre className="bg-black border border-neutral-800 rounded-xl p-4 font-mono text-[10px] text-blue-400 break-all whitespace-pre-wrap overflow-hidden">
              {bookmarkletCode}
            </pre>
            <button
              onClick={() => {
                navigator.clipboard.writeText(bookmarkletCode);
                alert("Code copié !");
              }}
              className="absolute top-2 right-2 p-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-white transition-all shadow-lg"
              title="Copier le code"
            >
              <Save className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-3 p-4 bg-blue-950/10 border border-blue-900/20 rounded-xl">
            <h3 className="text-blue-400 font-bold">Méthode manuelle (Mobile & PC) :</h3>
            <ol className="list-decimal list-inside space-y-2 text-neutral-500">
              <li>Copiez le code bleu ci-dessus.</li>
              <li>Créez un nouveau favori (n'importe quelle page).</li>
              <li>Modifiez ce favori (Renommer : "VigiPrix Import").</li>
              <li>Dans le champ <span className="text-white">URL / Adresse</span>, effacez tout et collez le code.</li>
              <li>Enregistrez. C'est prêt !</li>
            </ol>
          </div>
        </div>
      </div>

      <div className="text-center">
        <Link href="/" className="text-xs text-neutral-600 hover:text-neutral-400 font-medium">
          Retour à l'accueil
        </Link>
      </div>
    </div>
  );
}

export default function ImportPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0c] p-6 pt-12">
      <Suspense fallback={<div className="text-white text-center">Chargement...</div>}>
        <ImportForm />
      </Suspense>
    </main>
  );
}
