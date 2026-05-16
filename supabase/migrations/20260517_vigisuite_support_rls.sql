-- Migration : Sécurisation RLS du Module Support
-- Date : 2026-05-17
-- Objectif : Appliquer des politiques d'accès multi-tenant strictes basées sur la table profiles.

-- 1. Activation de RLS (Sécurité par défaut)
ALTER TABLE support_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;

-- 2. Nettoyage des anciennes politiques éventuelles
-- (On s'assure qu'aucune politique restrictive par défaut ne bloque la visibilité)
DROP POLICY IF EXISTS "Support conversations visibility" ON support_conversations;
DROP POLICY IF EXISTS "Support messages visibility" ON support_messages;
DROP POLICY IF EXISTS "Users can read their own conversations" ON support_conversations;
DROP POLICY IF EXISTS "Users can read their own messages" ON support_messages;
DROP POLICY IF EXISTS "Users can insert their own messages" ON support_messages;

-- ==============================================================================
-- 3. Politiques pour SUPPORT_CONVERSATIONS
-- ==============================================================================

-- A. Platform Admin : Accès total (Bypass)
CREATE POLICY "Platform Admin can manage all conversations" 
ON support_conversations 
FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'platform_admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'platform_admin'
  )
);

-- B. Adhérent : Accès restreint à son magasin (Lecture / Écriture)
CREATE POLICY "Adherant can manage store conversations" 
ON support_conversations 
FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role = 'adherant' 
    AND store_id = support_conversations.store_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role = 'adherant' 
    AND store_id = support_conversations.store_id
  )
);

-- ==============================================================================
-- 4. Politiques pour SUPPORT_MESSAGES
-- ==============================================================================

-- A. Platform Admin : Accès total (Bypass)
CREATE POLICY "Platform Admin can manage all messages" 
ON support_messages 
FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'platform_admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'platform_admin'
  )
);

-- B. Adhérent : Accès restreint aux messages des conversations de son magasin
CREATE POLICY "Adherant can manage store messages" 
ON support_messages 
FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM support_conversations sc
    JOIN profiles p ON p.id = auth.uid()
    WHERE sc.id = support_messages.conversation_id
    AND p.role = 'adherant'
    AND p.store_id = sc.store_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM support_conversations sc
    JOIN profiles p ON p.id = auth.uid()
    WHERE sc.id = support_messages.conversation_id
    AND p.role = 'adherant'
    AND p.store_id = sc.store_id
  )
);

-- Documentation
COMMENT ON TABLE support_conversations IS 'Isolé par RLS. Visibilité par store_id pour adhérents, globale pour platform_admin.';
COMMENT ON TABLE support_messages IS 'Isolé par RLS en cascade via la conversation. Visibilité par store_id pour adhérents, globale pour platform_admin.';
