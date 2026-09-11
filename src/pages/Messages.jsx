import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { zimrent } from "@/api/zimrentClient";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, ArrowLeft, MessageSquare, AlertTriangle, ShieldAlert, Calendar, Lock, FileText, MapPin } from "lucide-react";
import { EmptyState, LoadingState } from "@/components/EmptyState";

export default function Messages() {
  const { conversationId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState([]);
  const [activeConvo, setActiveConvo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [fraudWarning, setFraudWarning] = useState(null);
  const [otherProfile, setOtherProfile] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const convos = await zimrent.conversations.list();
        setConversations(convos || []);
      } catch (e) {} finally { setLoading(false); }
    })();
  }, [user]);

  useEffect(() => {
    if (!conversationId || !user) return;
    (async () => {
      try {
        const { conversation, messages: msgs } = await zimrent.conversations.get(conversationId);
        setActiveConvo(conversation);
        setMessages(msgs || []);
        // Load the other participant's profile
        const otherId = conversation.tenant_id === user.id ? conversation.landlord_id : conversation.tenant_id;
        if (otherId) {
          const otherProfileData = await zimrent.profiles.getPublic(otherId);
          if (otherProfileData) setOtherProfile(otherProfileData);
        }
      } catch (e) {}
    })();
  }, [conversationId, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !activeConvo) return;
    setSending(true);
    setFraudWarning(null);
    try {
      // Off-platform-contact scanning happens server-side in send.ts —
      // the response tells us whether this message got flagged.
      const msg = await zimrent.conversations.sendMessage(conversationId, newMessage);
      setMessages(prev => [...prev, msg]);
      setNewMessage("");

      if (msg.flagged) {
        setFraudWarning("This message was flagged for mentioning off-platform contact details or payments. For your safety, keep all communication and payments within the platform.");
      }
    } catch (e) { alert(e.message); }
    finally { setSending(false); }
  };

  if (loading) return <LoadingState label="Loading messages..." />;

  return (
    <div className="h-[calc(100vh-3.5rem)] lg:h-screen flex flex-col lg:flex-row">
      {/* Conversation list */}
      <div className={`${conversationId ? "hidden lg:flex" : "flex"} flex-col w-full lg:w-80 border-r border-border bg-card`}>
        <div className="p-4 border-b border-border">
          <h1 className="font-heading font-bold text-lg">Messages</h1>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {conversations.length === 0 ? (
            <div className="p-4">
              <EmptyState icon={MessageSquare} title="No conversations" description="Start chatting from a property page." />
            </div>
          ) : conversations.map(c => (
            <button key={c.id} onClick={() => navigate(`/messages/${c.id}`)}
              className={`w-full p-4 border-b border-border text-left hover:bg-muted transition-colors ${conversationId === c.id ? "bg-primary/5" : ""}`}>
              <p className="font-medium text-sm truncate">{c.property_title || "Conversation"}</p>
              <p className="text-xs text-muted-foreground truncate mt-1">{c.last_message_preview || "No messages yet"}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Chat view */}
      <div className={`${!conversationId ? "hidden lg:flex" : "flex"} flex-1 flex-col`}>
        {activeConvo ? (
          <>
            <div className="p-4 border-b border-border bg-card">
              <div className="flex items-center gap-3">
                <button onClick={() => navigate("/messages")} className="lg:hidden p-1 -ml-1">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="flex-1">
                  <p className="font-medium text-sm">{activeConvo.property_title}</p>
                  {otherProfile && (
                    <Link to={`/profile/${otherProfile.id}`} className="text-xs text-muted-foreground hover:underline">
                      {otherProfile.data?.display_name}
                    </Link>
                  )}
                </div>
              </div>
              {/* Contextual actions */}
              <div className="flex flex-wrap gap-2 mt-3">
                {activeConvo.property_id && (
                  <Button size="sm" variant="outline" className="h-8 text-xs" asChild>
                    <Link to={`/property/${activeConvo.property_id}`}><MapPin className="w-3.5 h-3.5 mr-1.5" /> View property</Link>
                  </Button>
                )}
                {activeConvo.listing_id && (
                  <>
                    <Button size="sm" variant="outline" className="h-8 text-xs" asChild>
                      <Link to={`/reserve/${activeConvo.listing_id}`}><Lock className="w-3.5 h-3.5 mr-1.5" /> Reserve</Link>
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 text-xs" asChild>
                      <Link to={`/apply/${activeConvo.listing_id}`}><FileText className="w-3.5 h-3.5 mr-1.5" /> Apply</Link>
                    </Button>
                  </>
                )}
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => navigate(`/property/${activeConvo.property_id}`)}>
                  <Calendar className="w-3.5 h-3.5 mr-1.5" /> Schedule viewing
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-3 bg-muted/30">
              {messages.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-8">Send a message to start the conversation.</p>
              )}
              {messages.map(m => {
                const isMine = m.sender_id === user.id;
                return (
                  <div key={m.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${isMine ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-card border border-border rounded-bl-sm"}`}>
                      <p className="text-sm whitespace-pre-wrap">{m.body}</p>
                      {m.flagged && (
                        <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-warning/30 text-xs text-warning">
                          <ShieldAlert className="w-3.5 h-3.5" /> Flagged for review
                        </div>
                      )}
                      <p className={`text-[10px] mt-1 ${isMine ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                        {new Date(m.created_date).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {fraudWarning && (
              <div className="px-4 py-2 bg-warning/10 border-t border-warning/20 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
                <p className="text-xs text-warning">{fraudWarning}</p>
              </div>
            )}

            <div className="p-4 border-t border-border bg-card">
              <div className="flex gap-2">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendMessage())}
                  placeholder="Type a message..."
                  className="flex-1"
                  disabled={sending}
                />
                <Button onClick={sendMessage} disabled={sending || !newMessage.trim()} size="icon">
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <EmptyState icon={MessageSquare} title="Select a conversation" description="Choose a conversation from the list to view messages." />
          </div>
        )}
      </div>
    </div>
  );
}