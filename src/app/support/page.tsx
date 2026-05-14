"use client";

import { useState, useEffect, useRef } from "react";
import { 
  MessageCircle, 
  Search, 
  ChevronRight, 
  Send, 
  User, 
  ShieldCheck, 
  Loader2,
  Clock,
  Filter,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

export default function AdminSupportPage() {
  const { profile, isAdmin, loading: profileLoading } = useProfile();
  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedConv, setSelectedConv] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState("open");
  const scrollRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  const [userEmails, setUserEmails] = useState<Record<string, string>>({});

  // 1. Charger toutes les conversations
  useEffect(() => {
    if (!isAdmin) return;

    const fetchConversations = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("support_conversations")
          .select("*")
          .order("updated_at", { ascending: false });

        if (error) {
          console.error("Supabase fetch error:", error);
          throw error;
        }
        setConversations(data || []);

        // Fetch emails séparément pour éviter les bugs de jointure
        if (data && data.length > 0) {
          const userIds = Array.from(new Set(data.map((c: any) => c.user_id)));
          const { data: profiles, error: pError } = await supabase
            .from("profiles")
            .select("id, email")
            .in("id", userIds);
          
          if (!pError && profiles) {
            const emailMap = profiles.reduce((acc: any, p: any) => ({
              ...acc,
              [p.id]: p.email
            }), {});
            setUserEmails(emailMap);
          }
        }
      } catch (err) {
        console.error("Fetch error details:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchConversations();

    // Realtime pour les conversations
    const channel = supabase
      .channel("support_conversations_admin")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "support_conversations" },
        () => fetchConversations()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin, supabase]);

  // 2. Charger les messages d'une conversation
  useEffect(() => {
    if (!selectedConv || !isAdmin) return;

    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from("support_messages")
        .select("*")
        .eq("conversation_id", selectedConv.id)
        .order("created_at", { ascending: true });

      if (!error) {
        setMessages(data || []);
        // Marquer comme lu pour l'admin
        if (selectedConv.unread_count_admin > 0) {
          // Update local state first (optimistic)
          setConversations(prev => prev.map(c => 
            c.id === selectedConv.id ? { ...c, unread_count_admin: 0 } : c
          ));
          
          const { error: updateError } = await supabase
            .from("support_conversations")
            .update({ unread_count_admin: 0 })
            .eq("id", selectedConv.id);
          
          if (updateError) {
            console.error("Failed to reset admin unread count:", updateError);
          }
        }
      }
    };

    fetchMessages();

    // Realtime pour les messages
    const channel = supabase
      .channel(`admin_msgs_${selectedConv.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_messages",
          filter: `conversation_id=eq.${selectedConv.id}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new]);
          // Marquer comme lu si c'est un message user et que la conversation est active
          if (!payload.new.is_admin) {
             setConversations(prev => prev.map(c => 
               c.id === selectedConv.id ? { ...c, unread_count_admin: 0, last_message: payload.new.message } : c
             ));
             
             supabase
              .from("support_conversations")
              .update({ unread_count_admin: 0 })
              .eq("id", selectedConv.id)
              .then();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedConv?.id, isAdmin, supabase]);

  // 3. Scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConv || sending) return;

    setSending(true);
    try {
      const { error } = await supabase.from("support_messages").insert({
        conversation_id: selectedConv.id,
        sender_id: profile!.id,
        message: newMessage.trim(),
        is_admin: true,
      });

      if (error) throw error;
      setNewMessage("");
    } catch (err) {
      console.error("Send error:", err);
    } finally {
      setSending(false);
    }
  };

  const toggleStatus = async (conv: any) => {
     const newStatus = conv.status === "open" ? "closed" : "open";
     const { error } = await supabase
       .from("support_conversations")
       .update({ status: newStatus })
       .eq("id", conv.id);
     
     if (!error && selectedConv?.id === conv.id) {
        setSelectedConv({ ...selectedConv, status: newStatus });
     }
  };

  if (profileLoading) return null;
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center space-y-4">
        <AlertCircle className="w-16 h-16 text-red-500 opacity-20" />
        <h1 className="text-xl font-black text-white uppercase tracking-widest">Accès Réservé</h1>
        <p className="text-sm text-neutral-500 max-w-xs">Seuls les administrateurs VigiPrix peuvent accéder au centre de support.</p>
      </div>
    );
  }

  const filteredConvs = conversations.filter(c => filter === "all" || c.status === filter);

  return (
    <main className="min-h-screen bg-[#0a0a0c] flex flex-col lg:flex-row overflow-hidden h-screen lg:h-screen">
      {/* Sidebar Conversations */}
      <aside className="w-full lg:w-96 border-r border-neutral-800 flex flex-col bg-[#0d0d0f] z-20">
        <div className="p-6 border-b border-neutral-800">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-2xl bg-red-600 flex items-center justify-center text-white shadow-lg shadow-red-600/20">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-black text-white uppercase tracking-widest leading-none">Support Admin</h1>
              <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mt-1">VigiPrix Control</p>
            </div>
          </div>

          <div className="flex gap-2 p-1 bg-black rounded-xl border border-neutral-800">
            {["open", "closed", "all"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${
                  filter === f ? "bg-red-600 text-white shadow-lg shadow-red-600/10" : "text-neutral-500 hover:text-neutral-300"
                }`}
              >
                {f === "open" ? "Ouvert" : f === "closed" ? "Fermé" : "Tous"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-hide">
          {loading ? (
            <div className="p-8 text-center opacity-30 animate-pulse">Chargement...</div>
          ) : filteredConvs.length === 0 ? (
            <div className="p-12 text-center space-y-3 opacity-20">
               <MessageCircle className="w-12 h-12 mx-auto" />
               <p className="text-xs font-bold uppercase tracking-widest">Aucune discussion</p>
            </div>
          ) : (
            filteredConvs.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setSelectedConv(conv)}
                className={`w-full p-5 border-b border-neutral-800/50 flex items-start gap-4 text-left transition-all hover:bg-white/[0.02] relative group ${
                  selectedConv?.id === conv.id ? "bg-white/[0.03] border-r-2 border-r-red-600" : ""
                }`}
              >
                <div className="w-12 h-12 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-500 shrink-0 group-hover:scale-110 transition-transform">
                  <User className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="text-sm font-black text-white truncate pr-2">
                      {userEmails[conv.user_id] || `Utilisateur ${conv.user_id.split('-')[0]}`}
                    </h3>
                    <span className="text-[9px] font-bold text-neutral-600 whitespace-nowrap mt-1">
                      {formatDistanceToNow(new Date(conv.updated_at), { addSuffix: true, locale: fr })}
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-500 line-clamp-1 mb-2">
                    {conv.last_message || "Nouvelle conversation"}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className={`text-[8px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded-full border ${
                      conv.status === 'open' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-neutral-800 text-neutral-500 border-neutral-700'
                    }`}>
                      {conv.status === 'open' ? 'En cours' : 'Traité'}
                    </span>
                  </div>
                </div>
                {conv.unread_count_admin > 0 && (
                   <div className="absolute right-4 bottom-5 w-5 h-5 bg-red-600 rounded-full flex items-center justify-center text-[10px] font-black text-white shadow-lg shadow-red-600/20">
                     {conv.unread_count_admin}
                   </div>
                )}
              </button>
            ))
          )}
        </div>
      </aside>

      {/* Main Chat Panel */}
      <section className="flex-1 flex flex-col bg-black lg:bg-transparent relative h-[calc(100vh-80px)] lg:h-screen">
        {selectedConv ? (
          <>
            {/* Header */}
            <div className="p-6 bg-[#0d0d0f] border-b border-neutral-800 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-red-600/10 flex items-center justify-center text-red-500 border border-red-500/20">
                  <User className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-white uppercase tracking-widest">
                    {userEmails[selectedConv.user_id] || `Utilisateur ${selectedConv.user_id.split('-')[0]}`}
                  </h2>
                  <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mt-1">
                    Conversation • {selectedConv.status === 'open' ? 'Discussion active' : 'Archivée'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                 <button 
                   onClick={() => toggleStatus(selectedConv)}
                   className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                     selectedConv.status === 'open' 
                       ? 'bg-neutral-900 border-neutral-800 text-neutral-500 hover:bg-neutral-800' 
                       : 'bg-emerald-600/10 border-emerald-500/20 text-emerald-500 hover:bg-emerald-600/20'
                   }`}
                 >
                   {selectedConv.status === 'open' ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                   {selectedConv.status === 'open' ? 'Clôturer' : 'Réouvrir'}
                 </button>
              </div>
            </div>

            {/* Messages Area */}
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-8 space-y-6 bg-gradient-to-b from-[#0a0a0c] to-black scrollbar-hide"
            >
              {messages.map((msg) => (
                <div 
                  key={msg.id}
                  className={`flex ${msg.is_admin ? "justify-end" : "justify-start"}`}
                >
                  <div className="max-w-[70%] space-y-1.5">
                    <div className={`p-4 rounded-3xl text-sm font-medium leading-relaxed shadow-xl ${
                      msg.is_admin 
                        ? "bg-red-600 text-white rounded-tr-none shadow-red-600/10" 
                        : "bg-neutral-900 text-neutral-300 rounded-tl-none border border-neutral-800/50"
                    }`}>
                      {msg.message}
                    </div>
                    <div className={`text-[8px] uppercase font-black tracking-widest opacity-40 px-2 ${msg.is_admin ? "text-right" : "text-left"}`}>
                      {format(new Date(msg.created_at), "HH:mm", { locale: fr })}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Input Area */}
            <div className="p-6 bg-[#0d0d0f] border-t border-neutral-800">
               <form onSubmit={handleSendMessage} className="relative max-w-4xl mx-auto">
                 <textarea 
                   rows={1}
                   placeholder="Tapez votre réponse ici..."
                   value={newMessage}
                   onChange={(e) => setNewMessage(e.target.value)}
                   onKeyDown={(e) => {
                     if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage(e as any);
                     }
                   }}
                   className="w-full bg-black border border-neutral-800 rounded-2xl px-6 py-4 text-sm text-white placeholder-neutral-700 outline-none focus:border-red-600/50 transition-all resize-none pr-20"
                 />
                 <button 
                   type="submit"
                   disabled={!newMessage.trim() || sending}
                   className="absolute right-2 top-2 bottom-2 px-6 bg-red-600 rounded-xl flex items-center justify-center text-white disabled:opacity-50 disabled:grayscale transition-all shadow-lg shadow-red-600/20"
                 >
                   {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                 </button>
               </form>
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-6 opacity-30">
            <div className="w-24 h-24 rounded-[2.5rem] bg-neutral-900 flex items-center justify-center border border-neutral-800">
               <MessageCircle className="w-10 h-10 text-neutral-500" />
            </div>
            <div className="max-w-xs">
              <h2 className="text-xl font-black text-white uppercase tracking-[0.2em] mb-2">Centre de Commande</h2>
              <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Sélectionnez une discussion pour commencer à aider vos utilisateurs.</p>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
