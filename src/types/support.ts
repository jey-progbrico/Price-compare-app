export interface SupportConversation {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  status: "open" | "closed";
  last_message: string | null;
  unread_count_admin: number;
  unread_count_user: number;
  profiles?: {
    email: string;
  };
}

export interface SupportMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  message: string;
  created_at: string;
  is_admin: boolean;
}
