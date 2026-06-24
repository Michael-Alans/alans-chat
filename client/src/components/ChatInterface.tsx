import { useEffect, useState, useRef } from 'react';
import { useAuth, useUser } from '@clerk/clerk-react';
import { io, Socket } from 'socket.io-client';

interface MessagePayload {
  _id: string;
  username: string;
  userId: string;
  text: string;
  replyTo?: {
    messageId: string;
    username: string;
    text: string;
  };
  createdAt: string;
}

const AV_ROOMS = ['General', 'Engineering', 'System Architecture', 'Frontend', 'Backend', 'Data Science', 'DevOps'];

// --- Helper Component: Handles Physics and Individual Message Layout ---
const MessageBubble = ({ 
  msg, isOwn, onReply, onEdit, onDelete 
}: { 
  msg: MessagePayload, isOwn: boolean, 
  onReply: (m: MessagePayload) => void, 
  onEdit: (m: MessagePayload) => void, 
  onDelete: (id: string) => void 
}) => {
  const [dragX, setDragX] = useState(0);
  const dragStartRef = useRef<number | null>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    dragStartRef.current = e.clientX;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (dragStartRef.current !== null) {
      const delta = Math.max(0, e.clientX - dragStartRef.current);
      setDragX(Math.min(delta, 80)); // Max drag radius 80px
    }
  };

  const handlePointerUp = () => {
    if (dragStartRef.current !== null && dragX > 50) {
      onReply(msg);
    }
    dragStartRef.current = null;
    setDragX(0); // Spring snap back
  };

  return (
    <div className="flex flex-col group animate-message gap-1 overflow-x-hidden p-1 -m-1">
      <div className="flex items-baseline gap-3">
        <span className="font-bold text-sm bg-gradient-to-r from-indigo-400 to-fuchsia-400 bg-clip-text text-transparent">
          {msg.username}
        </span>
        <span className="text-[10px] font-mono text-slate-600 group-hover:text-slate-400 transition-colors">
          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      <div className="flex items-center gap-3">
        {/* The draggable physics wrapper */}
        <div 
          onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp}
          className="inline-block flex-col self-start max-w-[85%] bg-slate-800/40 backdrop-blur-sm border border-white/5 rounded-2xl rounded-tl-sm px-4 py-2.5 shadow-sm select-none cursor-grab active:cursor-grabbing"
          style={{ 
            transform: `translateX(${dragX}px)`, 
            transition: dragStartRef.current !== null ? 'none' : 'transform 0.2s cubic-bezier(0.18, 0.89, 0.32, 1.28)' 
          }}
        >
          {msg.replyTo && (
            <div className="mb-2 pl-3 py-1.5 border-l-2 border-indigo-400 bg-slate-900/50 rounded-r-lg opacity-80 text-xs">
              <span className="font-bold text-indigo-300 block mb-0.5">{msg.replyTo.username}</span>
              <span className="text-slate-400 line-clamp-1 italic">"{msg.replyTo.text}"</span>
            </div>
          )}
          <p className="text-slate-200 text-[15px] leading-relaxed break-words">{msg.text}</p>
        </div>

        {/* Hover Action Controls (Only show if owned) */}
        {isOwn && (
          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2">
            <button onClick={() => onEdit(msg)} className="p-1.5 rounded-full bg-slate-800/50 text-indigo-400 hover:bg-slate-700 hover:text-indigo-300 hover-lift" title="Edit">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
            </button>
            <button onClick={() => onDelete(msg._id)} className="p-1.5 rounded-full bg-slate-800/50 text-rose-400 hover:bg-rose-900/40 hover:text-rose-300 hover-lift" title="Delete">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};


export default function ChatInterface() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const [socket, setSocket] = useState<Socket | null>(null);
  
  const [activeRoom, setActiveRoom] = useState('General');
  const [messages, setMessages] = useState<MessagePayload[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [presence, setPresence] = useState<string[]>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  
  const [replyingTo, setReplyingTo] = useState<MessagePayload | null>(null);
  const [editingMessage, setEditingMessage] = useState<MessagePayload | null>(null);
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hook Loop 1: Connect to your socket and mount event listeners
  useEffect(() => {
    let socketInstance: Socket;

    const initSocket = async () => {
      const token = await getToken();
      socketInstance = io('http://localhost:5000', {
        auth: { token }
      });

      socketInstance.on('room:history', (history: MessagePayload[]) => setMessages(history));
      socketInstance.on('message:received', (msg: MessagePayload) => setMessages((prev) => [...prev, msg]));
      socketInstance.on('message:updated', (updated: MessagePayload) => setMessages(prev => prev.map(m => m._id === updated._id ? updated : m)));
      socketInstance.on('message:deleted', ({ id }) => setMessages(prev => prev.filter(m => m._id !== id)));
      socketInstance.on('room:presence', (users: string[]) => setPresence(users));
      
      socketInstance.on('typing:status', ({ username, isTyping }: { username: string; isTyping: boolean }) => {
        setTypingUsers((prev) => 
          isTyping ? [...prev.filter(u => u !== username), username] : prev.filter(u => u !== username)
        );
      });

      setSocket(socketInstance);
    };

    initSocket();
    return () => { socketInstance?.disconnect(); };
  }, [getToken]);

  // Hook Loop 2: Handle room switching adjustments
  useEffect(() => {
    if (!socket) return;
    setMessages([]);
    setTypingUsers([]);
    setReplyingTo(null);
    setEditingMessage(null);
    socket.emit('room:join', { roomId: activeRoom });
  }, [activeRoom, socket]);

  // Hook Loop 3: Auto Scroll UI view to keep focus on fresh incoming data elements
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsers, replyingTo, editingMessage]);

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !socket) return;

    if (editingMessage) {
      socket.emit('message:update', { id: editingMessage._id, text: inputMessage });
      setEditingMessage(null);
    } else {
      socket.emit('message:send', { 
        text: inputMessage,
        replyTo: replyingTo ? { messageId: replyingTo._id, username: replyingTo.username, text: replyingTo.text } : undefined
      });
      setReplyingTo(null);
    }

    socket.emit('typing:stop');
    setInputMessage('');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputMessage(e.target.value);
    if (!socket) return;

    socket.emit('typing:start');
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing:stop');
    }, 2000);
  };

  const startEdit = (msg: MessagePayload) => {
    setEditingMessage(msg);
    setReplyingTo(null); // Prevent replying and editing at exact same time
    setInputMessage(msg.text);
  };

  const startReply = (msg: MessagePayload) => {
    setReplyingTo(msg);
    setEditingMessage(null);
  };

  const handleDelete = (id: string) => {
    if (socket && confirm("Obliterate this message from the server?")) {
      socket.emit('message:delete', { id });
    }
  }

  const cancelAction = () => {
    setReplyingTo(null);
    if (editingMessage) {
      setEditingMessage(null);
      setInputMessage('');
    }
  }

  return (
    <div className="w-full max-w-5xl h-[85vh] md:h-[80vh] grid grid-cols-1 md:grid-cols-4 glass-card overflow-hidden shadow-2xl relative min-h-0">
      {/* Sidebar Navigation Context Lists */}
      <div className={`${isSidebarOpen ? 'absolute inset-0 z-50 flex bg-slate-900/95' : 'hidden'} md:flex border-r border-white/5 bg-slate-900/30 backdrop-blur-sm p-4 md:p-5 space-y-8 flex-col h-full md:relative min-h-0`}>
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Channels</h3>
            <div className="flex items-center gap-2">
              <span className="bg-indigo-500/20 text-indigo-400 text-[10px] px-2 py-0.5 rounded-full">+ New</span>
              <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-slate-400 p-1 bg-slate-800 rounded-md">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            {AV_ROOMS.map(room => (
              <button key={room} onClick={() => { setActiveRoom(room); setIsSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${activeRoom === room ? 'bg-indigo-600 shadow-lg shadow-indigo-500/20 text-white translate-x-1' : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'}`}>
                <span className={activeRoom === room ? "text-indigo-200" : "text-slate-600"}>#</span>
                {room}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Presence</h3>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <div className="space-y-2">
            {presence.map((u, idx) => (
              <div key={idx} className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-slate-800/30 transition-colors group cursor-default">
                <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-emerald-400/20 to-teal-400/20 border border-emerald-500/30 flex items-center justify-center relative shadow-sm">
                  <span className="text-emerald-400 text-xs font-bold">{u.charAt(0).toUpperCase()}</span>
                  <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 border-2 border-slate-900"></span>
                </div>
                <span className="text-sm text-slate-300 group-hover:text-white transition-colors">{u}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Stream Conversational Framework Content blocks */}
      <div className="col-span-1 md:col-span-3 flex flex-col h-full bg-slate-950/20 z-0 relative min-h-0">
        <div className="p-4 md:p-6 border-b border-white/5 glass-panel z-20 flex justify-between items-center sticky top-0 shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsSidebarOpen(true)} className="md:hidden text-slate-400 p-2 hover:bg-slate-800 rounded-lg">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <div>
              <h2 className="font-bold text-xl text-slate-100 tracking-tight flex items-center gap-2">
                 <span className="text-indigo-500">#</span> {activeRoom}
              </h2>
              <p className="text-xs text-slate-500 mt-1">{presence.length} verified connections • encrypted stream</p>
            </div>
          </div>
        </div>

        {/* Message Rendering Windows */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 scroll-smooth min-h-0">
          {messages.map((msg) => (
            <MessageBubble 
              key={msg._id} 
              msg={msg} 
              isOwn={msg.userId === user?.id} 
              onReply={startReply} 
              onEdit={startEdit} 
              onDelete={handleDelete} 
            />
          ))}
          
          {typingUsers.length > 0 && (
            <div className="text-xs text-indigo-400 flex items-center gap-2 animate-fade-in pl-2">
               <div className="flex gap-1">
                 <span className="w-1 h-1 bg-indigo-500 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></span>
                 <span className="w-1 h-1 bg-indigo-500 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></span>
                 <span className="w-1 h-1 bg-indigo-500 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></span>
               </div>
              {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
            </div>
          )}
          <div ref={scrollRef} className="h-4" />
        </div>

        {/* Text Input Interface Form Group */}
        <div className="p-4 md:p-5 border-t border-white/5 glass-panel z-20 flex flex-col gap-3 shrink-0">
          
          {/* Active Context Banners (Reply or Edit) */}
          {(replyingTo || editingMessage) && (
            <div className="animate-fade-in flex items-center justify-between bg-slate-800/60 border border-white/10 rounded-lg px-4 py-2">
              <div className="flex items-center gap-3">
                <div className={`w-1 h-8 rounded-full ${editingMessage ? 'bg-fuchsia-500' : 'bg-indigo-500'}`}></div>
                <div>
                  <span className="text-xs font-bold text-slate-300 block">
                    {editingMessage ? 'Editing Message' : `Replying to ${replyingTo?.username}`}
                  </span>
                  <span className="text-xs text-slate-400 italic line-clamp-1">
                    "{editingMessage ? editingMessage.text : replyingTo?.text}"
                  </span>
                </div>
              </div>
              <button onClick={cancelAction} className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-700 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          )}

          <form onSubmit={sendMessage} className="relative flex items-center group">
            <input
              type="text"
              value={inputMessage}
              onChange={handleInputChange}
              placeholder={`Signal #${activeRoom}...`}
              className="w-full bg-slate-900/60 border border-slate-700/50 rounded-full pl-6 pr-14 py-3.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 transition-all shadow-inner"
            />
            <button type="submit" disabled={!inputMessage.trim()} className={`absolute right-2 p-2.5 rounded-full ${editingMessage ? 'bg-gradient-to-r from-fuchsia-600 to-rose-500 hover:from-fuchsia-500 hover:to-rose-400 shadow-fuchsia-500/20' : 'bg-gradient-to-r from-indigo-600 to-fuchsia-600 hover:from-indigo-500 hover:to-fuchsia-500 shadow-indigo-500/20'} disabled:opacity-50 disabled:cursor-not-allowed transition-all text-white hover-lift shadow-lg`}>
               {editingMessage ? (
                 <svg className="w-4 h-4 translate-x-[0.5px] translate-y-[-0.5px]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
               ) : (
                 <svg className="w-4 h-4 translate-x-[1px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
               )}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}