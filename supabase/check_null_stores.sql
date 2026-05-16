SELECT count(*) as conv_null_stores FROM support_conversations WHERE store_id IS NULL;
SELECT count(*) as msg_null_conversations FROM support_messages sm 
LEFT JOIN support_conversations sc ON sm.conversation_id = sc.id 
WHERE sc.store_id IS NULL;
