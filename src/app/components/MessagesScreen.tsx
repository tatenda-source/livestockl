import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router";
import { ArrowLeft, Send, Loader2, MessageCircle } from "lucide-react";
import { useConversations, useMessages, useSendMessage } from "../../hooks/useMessages";
import { useAuthStore } from "../../stores/authStore";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Avatar, AvatarFallback } from "./ui/avatar";

function formatTime(timestamp: string) {
  const now = new Date();
  const date = new Date(timestamp);
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

function formatMessageTime(timestamp: string) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Conversation List View
function ConversationList() {
  const navigate = useNavigate();
  const { data: conversations, isLoading } = useConversations();
  const user = useAuthStore((s) => s.user);

  const items = conversations || [];

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 bg-background z-10 border-b">
        <div className="p-4">
          <h1 className="font-semibold text-lg">Messages</h1>
        </div>
      </div>

      <div className="p-4 space-y-2">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12">
            <MessageCircle className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No conversations yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Start a conversation from a listing page
            </p>
          </div>
        ) : (
          items.map((conv: any) => {
            const otherName = conv.other_participant
              ? `${conv.other_participant.first_name || ''} ${conv.other_participant.last_name || ''}`.trim()
              : 'Unknown';
            const initials = otherName
              .split(' ')
              .map((n: string) => n.charAt(0))
              .join('')
              .toUpperCase()
              .slice(0, 2);
            const itemTitle = conv.livestock_items?.title;

            return (
              <button
                key={conv.id}
                onClick={() => navigate(`/messages/${conv.id}`)}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left"
              >
                <Avatar className="w-12 h-12 shrink-0">
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {initials || '?'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm truncate">{otherName}</span>
                    <span className="text-xs text-muted-foreground shrink-0 ml-2">
                      {formatTime(conv.last_message_at)}
                    </span>
                  </div>
                  {itemTitle && (
                    <p className="text-xs text-primary truncate">Re: {itemTitle}</p>
                  )}
                  <p className="text-sm text-muted-foreground truncate mt-0.5">
                    {conv.last_message || 'No messages yet'}
                  </p>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

// Chat View
function ChatView({ conversationId }: { conversationId: string }) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const { data: messages, isLoading } = useMessages(conversationId);
  const { data: conversations } = useConversations();
  const sendMessage = useSendMessage();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const conversation = (conversations || []).find((c: any) => c.id === conversationId);
  const otherName = conversation?.other_participant
    ? `${conversation.other_participant.first_name || ''} ${conversation.other_participant.last_name || ''}`.trim()
    : 'Chat';
  const itemTitle = conversation?.livestock_items?.title;

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const content = input.trim();
    if (!content) return;
    setInput('');
    try {
      await sendMessage.mutateAsync({ conversationId, content });
    } catch {
      // Restore input on error
      setInput(content);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="sticky top-0 bg-background z-10 border-b p-4 flex items-center gap-3">
        <button onClick={() => navigate('/messages')} className="shrink-0">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="min-w-0">
          <h1 className="font-semibold text-sm truncate">{otherName}</h1>
          {itemTitle && (
            <p className="text-xs text-muted-foreground truncate">Re: {itemTitle}</p>
          )}
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (messages || []).length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-sm">
              No messages yet. Say hello!
            </p>
          </div>
        ) : (
          (messages || []).map((msg: any) => {
            const isOwn = msg.sender_id === user?.id;
            return (
              <div
                key={msg.id}
                className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                    isOwn
                      ? 'bg-primary text-primary-foreground rounded-br-sm'
                      : 'bg-muted text-foreground rounded-bl-sm'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                  <p
                    className={`text-[10px] mt-1 ${
                      isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'
                    }`}
                  >
                    {formatMessageTime(msg.created_at)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="sticky bottom-16 bg-card border-t p-3">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="flex-1"
            maxLength={2000}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || sendMessage.isPending}
            size="icon"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// Main component that switches between list and chat views
export function MessagesScreen() {
  const { conversationId } = useParams();

  if (conversationId) {
    return <ChatView conversationId={conversationId} />;
  }

  return <ConversationList />;
}
