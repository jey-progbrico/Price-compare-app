import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function audit() {
  console.log('--- AUDIT DES CONVERSATIONS SUPPORT ---');
  
  // Compter les conversations avec store_id = NULL
  const { count: convNullCount, error: err1 } = await supabase
    .from('support_conversations')
    .select('*', { count: 'exact', head: true })
    .is('store_id', null);
  
  console.log(`Conversations orphelines (store_id NULL) : ${convNullCount || 0}`);

  // Afficher un aperçu de ces conversations
  if (convNullCount > 0) {
    const { data: convs, error: err2 } = await supabase
      .from('support_conversations')
      .select('id, user_id, status, created_at')
      .is('store_id', null)
      .limit(5);
    console.log('Aperçu des conversations orphelines :');
    console.table(convs);
  }

  console.log('\n--- AUDIT DES MESSAGES SUPPORT ---');
  // Compter les messages liés à des conversations orphelines
  const { data: orphanMessages, error: err3 } = await supabase
    .from('support_messages')
    .select('id, message, is_admin, created_at, support_conversations!inner(store_id)')
    .is('support_conversations.store_id', null);

  console.log(`Messages liés à des conversations orphelines : ${orphanMessages?.length || 0}`);
  
  if (orphanMessages && orphanMessages.length > 0) {
    console.log('Aperçu des messages impactés :');
    console.table(orphanMessages.slice(0, 5).map(m => ({
      id: m.id,
      message: m.message,
      is_admin: m.is_admin,
      created_at: m.created_at
    })));
  }
}

audit().catch(console.error);
