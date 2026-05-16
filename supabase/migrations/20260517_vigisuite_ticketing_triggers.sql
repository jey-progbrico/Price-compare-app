-- Migration : Amélioration du système de ticketing (Triggers Auto-Reopen et Messages Système)
-- Date : 2026-05-17

-- 1. Modification du schéma
ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT false;
ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS system_type TEXT DEFAULT NULL;

-- Note: La colonne "status" de support_conversations est présumée de type TEXT.
-- Nous pouvons désormais l'utiliser pour : 'open', 'closed', 'pending', 'resolved'.

-- ===================================================================================
-- 2. Trigger : Réouverture automatique suite à un nouveau message humain
-- ===================================================================================
CREATE OR REPLACE FUNCTION trigger_support_auto_reopen()
RETURNS TRIGGER AS $$
BEGIN
    -- Si le message n'est pas un message système, et que la conversation n'est pas déjà ouverte
    IF NEW.is_system = false THEN
        UPDATE support_conversations 
        SET status = 'open',
            updated_at = NOW()
        WHERE id = NEW.conversation_id AND status IN ('closed', 'resolved');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_support_auto_reopen ON support_messages;
CREATE TRIGGER trg_support_auto_reopen
AFTER INSERT ON support_messages
FOR EACH ROW EXECUTE FUNCTION trigger_support_auto_reopen();


-- ===================================================================================
-- 3. Trigger : Message système automatique lors du changement de statut
-- ===================================================================================
CREATE OR REPLACE FUNCTION trigger_support_status_change()
RETURNS TRIGGER AS $$
DECLARE
    v_message TEXT;
    v_sys_type TEXT;
    v_sender_id UUID;
BEGIN
    -- Ne déclencher que si le statut a réellement changé
    IF NEW.status IS DISTINCT FROM OLD.status THEN
        
        -- Déterminer le type d'événement
        IF NEW.status = 'closed' THEN
            v_message := 'La demande a été clôturée par le support.';
            v_sys_type := 'ticket_closed';
        ELSIF NEW.status = 'resolved' THEN
            v_message := 'La demande a été marquée comme résolue.';
            v_sys_type := 'ticket_resolved';
        ELSIF NEW.status = 'open' AND OLD.status != 'open' THEN
            -- Message système pour la réouverture (ex: généré par le premier trigger ou manuel)
            v_message := 'La conversation a été réouverte suite à un nouveau message.';
            v_sys_type := 'ticket_reopened';
        END IF;

        -- Insérer le message système si un texte est défini
        IF v_message IS NOT NULL THEN
            v_sender_id := auth.uid();
            
            -- Fallback de sécurité (utile si déclenché par un CRON ou hors session RLS classique)
            IF v_sender_id IS NULL THEN
                v_sender_id := '00000000-0000-0000-0000-000000000000'::uuid;
            END IF;

            INSERT INTO support_messages (conversation_id, sender_id, message, is_admin, is_system, system_type)
            VALUES (
                NEW.id,
                v_sender_id,
                v_message,
                true, -- Considéré comme provenant de la plateforme
                true,
                v_sys_type
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_support_status_change ON support_conversations;
CREATE TRIGGER trg_support_status_change
AFTER UPDATE ON support_conversations
FOR EACH ROW EXECUTE FUNCTION trigger_support_status_change();
