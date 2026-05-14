"use client";

import { useState, useEffect, useRef } from "react";
import { MessageCircle, X, Send, User, ShieldCheck, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { SupportConversation, SupportMessage } from "@/types/support";
import { useSearchParams } from "next/navigation";

export default function SupportBubble() {
  const { profile } = useProfile();
  const searchParams = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);
  const [conversation, setConversation] = useState<SupportConversation | null>(null);
  
  // Ecoute du paramètre ?support=open
  useEffect(() => {
    if (searchParams.get("support") === "open") {
      setIsOpen(true);
    }
  }, [searchParams]);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  // 1. Initialiser la conversation
  useEffect(() => {
    if (!profile || !isOpen) return;

    const initSupport = async () => {
      setLoading(true);
      try {
        // Chercher ou créer la conversation
        const { data: conv, error: convError } = await supabase
          .from("support_conversations")
          .select("*")
          .eq("user_id", profile.id)
          .maybeSingle();

        if (convError) throw convError;

        let currentConv = conv;
        if (!conv) {
          const { data: newConv, error: createError } = await supabase
            .from("support_conversations")
            .insert({ user_id: profile.id })
            .select()
            .single();
          if (createError) throw createError;
          currentConv = newConv;
        }

        setConversation(currentConv);

        // Charger les messages
        const { data: msgs, error: msgsError } = await supabase
          .from("support_messages")
          .select("*")
          .eq("conversation_id", currentConv.id)
          .order("created_at", { ascending: true });

        if (msgsError) throw msgsError;
        setMessages(msgs || []);

        // Marquer comme lu
        if (currentConv.unread_count_user > 0) {
          setConversation({ ...currentConv, unread_count_user: 0 });
          const { error: updateError } = await supabase
            .from("support_conversations")
            .update({ unread_count_user: 0 })
            .eq("id", currentConv.id);

          if (updateError) {
            console.error("Failed to reset user unread count:", updateError);
          }
        }

      } catch (err) {
        console.error("Support error:", err);
      } finally {
        setLoading(false);
      }
    };

    initSupport();
  }, [profile, isOpen, supabase]);

  // 2. Realtime subscription messages + conversation sync
  useEffect(() => {
    if (!profile) return;

    // Subscription pour les changements de la conversation (badges)
    const convChannel = supabase
      .channel(`support_conv_sync_${profile.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "support_conversations",
          filter: `user_id=eq.${profile.id}`,
        },
        (payload) => {
          setConversation(payload.new as SupportConversation);
        }
      )
      .subscribe();

    // Subscription pour les messages (si ouvert)
    let msgChannel: any = null;
    if (isOpen && conversation?.id) {
      msgChannel = supabase
        .channel(`support_messages:${conversation.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "support_messages",
            filter: `conversation_id=eq.${conversation.id}`,
          },
          (payload) => {
            const newMsg = payload.new as SupportMessage;
            setMessages((prev) => [...prev, newMsg]);
            // Marquer comme lu si c'est un admin qui écrit et que le chat est ouvert
            if (newMsg.is_admin) {
               setConversation(prev => prev ? { ...prev, unread_count_user: 0 } : null);
               supabase
                .from("support_conversations")
                .update({ unread_count_user: 0 })
                .eq("id", conversation.id)
                .then();
            }
          }
        )
        .subscribe();
    }

    return () => {
      supabase.removeChannel(convChannel);
      if (msgChannel) supabase.removeChannel(msgChannel);
    };
  }, [profile, isOpen, conversation?.id, supabase]);

  // 3. Scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !conversation || sending) return;

    setSending(true);
    try {
      const { error } = await supabase.from("support_messages").insert({
        conversation_id: conversation.id,
        sender_id: profile!.id,
        message: newMessage.trim(),
        is_admin: false,
      });

      if (error) throw error;
      setNewMessage("");
    } catch (err) {
      console.error("Send error:", err);
    } finally {
      setSending(false);
    }
  };

  if (!profile) return null;

  return (
    <div className="fixed bottom-24 lg:bottom-8 right-6 z-[60]">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="absolute bottom-20 right-0 w-[calc(100vw-3rem)] sm:w-96 h-[500px] bg-[#0d0d0f] border border-neutral-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="p-5 bg-gradient-to-r from-red-600/10 to-transparent border-b border-neutral-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-red-600 flex items-center justify-center text-white shadow-lg shadow-red-600/20">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-widest">Support VigiPrix</h3>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest">Équipe en ligne</span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-white/5 rounded-xl text-neutral-500 hover:text-white transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Messages */}
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-hide"
            >
              {loading ? (
                <div className="h-full flex items-center justify-center">
                  <Loader2 className="w-6 h-6 text-neutral-700 animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-3 opacity-30">
                  <MessageCircle className="w-12 h-12" />
                  <p className="text-xs font-bold uppercase tracking-widest">Besoin d'aide ?<br/>Envoyez-nous un message.</p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div 
                    key={msg.id}
                    className={`flex ${msg.is_admin ? "justify-start" : "justify-end"}`}
                  >
                    <div className={`max-w-[80%] p-3.5 rounded-2xl text-xs font-medium leading-relaxed ${
                      msg.is_admin 
                        ? "bg-neutral-900 text-neutral-300 rounded-tl-none border border-neutral-800/50" 
                        : "bg-red-600 text-white rounded-tr-none shadow-lg shadow-red-600/10"
                    }`}>
                      {msg.message}
                      <div className={`text-[8px] mt-1.5 uppercase font-black tracking-widest opacity-50 ${msg.is_admin ? "text-neutral-500" : "text-red-100"}`}>
                        {format(new Date(msg.created_at), "HH:mm", { locale: fr })}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Input */}
            <form onSubmit={handleSendMessage} className="p-4 border-t border-neutral-800 bg-neutral-950/50">
              <div className="relative">
                <input 
                  type="text"
                  placeholder="Écrivez votre message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-2xl px-5 py-4 text-xs text-white placeholder-neutral-600 outline-none focus:border-red-600/50 transition-all pr-12"
                />
                <button 
                  type="submit"
                  disabled={!newMessage.trim() || sending}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center text-white disabled:opacity-50 disabled:grayscale transition-all shadow-lg shadow-red-600/20"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-2xl transition-all active:scale-95 group relative ${
          isOpen ? "bg-neutral-800" : "bg-red-600 shadow-red-600/20"
        }`}
      >
        {isOpen ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6 group-hover:scale-110 transition-transform" />}
        {!isOpen && (conversation?.unread_count_user ?? 0) > 0 && (
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 border-2 border-[#0a0a0c] rounded-full flex items-center justify-center text-[10px] font-black">
            {conversation?.unread_count_user}
          </div>
        )}
      </button>
    </div>
  );
}
