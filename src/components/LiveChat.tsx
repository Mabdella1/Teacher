import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Send, Paperclip, File, Download, X, Wifi, WifiOff, 
  Loader2, Image as ImageIcon, Check, User, FileText 
} from 'lucide-react';
import { ChatMessage, ChatFile } from '../types';

interface LiveChatProps {
  key?: string;
  role: 'teacher' | 'student';
  studentId: string;
  studentName: string;
  teacherName: string;
}

export default function LiveChat({ role, studentId, studentName, teacherName }: LiveChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // File attachments state
  const [attachedFile, setAttachedFile] = useState<ChatFile | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Initial history fetch via HTTP API
  useEffect(() => {
    setIsLoading(true);
    fetch(`/api/chat-history/${studentId}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch history');
        return res.json();
      })
      .then((data) => {
        if (data && data.messages) {
          // Check for duplicate prevention
          setMessages(data.messages);
        }
        setIsLoading(false);
      })
      .catch((err) => {
        console.error('Error fetching chat history:', err);
        setIsLoading(false);
      });
  }, [studentId]);

  // 2. Connect and maintain WebSocket connection
  useEffect(() => {
    function connectWebSocket() {
      if (socketRef.current) {
        socketRef.current.close();
      }

      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${wsProtocol}//${window.location.host}`;
      console.log('Connecting to WebSocket server:', wsUrl);
      
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        setIsConnected(true);
        console.log('WebSocket connection successfully opened.');
        
        // Register registration payload
        socket.send(JSON.stringify({
          type: 'register',
          role,
          studentId
        }));
      };

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'new_message') {
            const newMsg = payload.message as ChatMessage;
            if (newMsg.studentId === studentId) {
              setMessages((prev) => {
                // Ensure uniqueness (idempotent updates)
                if (prev.some((m) => m.id === newMsg.id)) return prev;
                return [...prev, newMsg];
              });
            }
          }
        } catch (err) {
          console.error('Failed to parse WebSocket message event:', err);
        }
      };

      socket.onclose = () => {
        setIsConnected(false);
        console.log('WebSocket connection closed. Attempting auto reconnection...');
        // Auto-reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          connectWebSocket();
        }, 3000);
      };

      socket.onerror = (err) => {
        console.error('WebSocket connection error:', err);
        socket.close();
      };
    }

    connectWebSocket();

    return () => {
      if (socketRef.current) {
        // Clear close handler to avoid triggering state update after unmount
        socketRef.current.onclose = null;
        socketRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [studentId, role]);

  // 3. Scroll to top/bottom helper
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // 4. File input handle helper
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processAndAttachFile(file);
  };

  const processAndAttachFile = (file: File) => {
    // Limit to 5MB to be safe and fast
    if (file.size > 5 * 1024 * 1024) {
      alert('حجم الملف المحدد كبير جداً! الحد الأقصى للمشاركة الفورية هو 5 ميجابايت.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64Data = reader.result as string;
      setAttachedFile({
        name: file.name,
        type: file.type,
        size: file.size,
        data: base64Data
      });
    };
    reader.readAsDataURL(file);
  };

  // Drag and Drop helpers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processAndAttachFile(file);
    }
  };

  // 5. Send message
  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    // Require text or attached file
    if (!inputText.trim() && !attachedFile) return;

    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      alert('لا يمكن الإرسال حالياً لعدم وجود اتصال نشط بالخادم. جاري محاولة إعادة الاتصال تلقائياً.');
      return;
    }

    const messagePayload = {
      type: 'message',
      studentId,
      sender: role,
      senderName: role === 'teacher' ? teacherName : studentName,
      text: inputText.trim(),
      file: attachedFile || undefined
    };

    socketRef.current.send(JSON.stringify(messagePayload));
    
    // Clear draft values
    setInputText('');
    setAttachedFile(null);
  };

  // KB/MB formatter helper
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} ب`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} ك.ب`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} م.ب`;
  };

  return (
    <div 
      className={`relative flex flex-col h-[600px] bg-slate-50 rounded-3xl border border-slate-200 overflow-hidden text-right font-sans ${
        isDragging ? 'ring-2 ring-indigo-500 ring-offset-1' : ''
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      dir="rtl"
    >
      {/* 1. Header with Connection Status */}
      <div className="bg-white border-b border-slate-200/80 px-5 py-3.5 flex items-center justify-between shadow-xs z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <User size={18} />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-800 leading-tight">
              {role === 'teacher' ? `المحادثة المستمرة للطلب: ${studentName}` : `التواصل المباشر مع: الأستاذ ${teacherName}`}
            </h4>
            <p className="text-[10px] text-slate-400 mt-0.5">
              مشاركة المستندات والتحصيل وملاحظات الدروس
            </p>
          </div>
        </div>

        {/* Live network status badge */}
        <div>
          {isConnected ? (
            <span className="inline-flex items-center gap-1 bg-emerald-55 bg-emerald-100 border border-emerald-250 text-emerald-700 text-[10px] font-bold py-1 px-2.5 rounded-full select-none shadow-3xs animate-pulse">
              <Wifi size={10} className="text-emerald-600" />
              <span>متصل الآن 🟢</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 bg-amber-55 bg-amber-100 border border-amber-200 text-amber-700 text-[10px] font-bold py-1 px-2.5 rounded-full select-none shadow-3xs">
              <Loader2 size={10} className="animate-spin text-amber-600" />
              <span>جاري الاتصال...</span>
            </span>
          )}
        </div>
      </div>

      {/* 2. Message History Area */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-thin bg-gradient-to-b from-slate-50 to-slate-100/50">
        {isLoading ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2 select-none">
            <Loader2 className="animate-spin text-indigo-650" size={28} />
            <p className="text-xs font-bold">جاري تحميل سجل المحادثة والملفات...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 py-10 text-center space-y-2 select-none">
            <div className="text-4xl">📎</div>
            <h4 className="text-xs font-black text-slate-700">لا توجد رسائل بينكما حتى الآن</h4>
            <p className="text-[10px] text-slate-400 max-w-xs px-4 leading-relaxed">
              ابدأ الآن بكتابة استفسار، إرسال ملف واجب، أو مناقشة واجبات اليوم المشتركة! تذكر أنه يمكنك سحب الملفات هنا فوراً للمشاركة.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => {
              // Determine if the message was sent by the active user
              const isOwnMessage = msg.sender === role;
              
              return (
                <div 
                  key={msg.id}
                  className={`flex ${isOwnMessage ? 'justify-start' : 'justify-end'} group`}
                >
                  <div className={`max-w-[75%] sm:max-w-[60%] flex flex-col ${isOwnMessage ? 'items-start' : 'items-end'}`}>
                    {/* Speaker name */}
                    <span className="text-[9px] text-slate-400 font-bold mb-1 px-1">
                      {msg.sender === 'teacher' ? `أ. ${teacherName}` : (msg.senderName || studentName)}
                    </span>

                    {/* Chat Bubble container */}
                    <div 
                      className={`p-3.5 rounded-2xl shadow-3xs ${
                        isOwnMessage 
                          ? 'bg-indigo-600 text-white rounded-tr-none' 
                          : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none'
                      }`}
                    >
                      {/* Attached File Visualizer */}
                      {msg.file && (
                        <div className="mb-2.5 rounded-xl overflow-hidden border border-slate-200/40 bg-slate-900/5">
                          {msg.file.type.startsWith('image/') ? (
                            <div className="relative group/image cursor-pointer" onClick={() => setLightboxImage(msg.file?.data || null)}>
                              <img 
                                src={msg.file.data} 
                                alt={msg.file.name} 
                                className="max-h-48 object-cover rounded-xl transition-transform hover:scale-101 border border-white/10" 
                                referrerPolicy="no-referrer"
                              />
                              <div className="absolute inset-0 bg-black/25 opacity-0 group-hover/image:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1 rounded-xl">
                                <ImageIcon size={14} />
                                <span>عرض الصورة كاملة</span>
                              </div>
                            </div>
                          ) : (
                            <div className="p-3 flex items-center justify-between gap-4 bg-slate-50 border border-slate-150 rounded-xl">
                              <div className="flex items-center gap-2">
                                <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold shrink-0">
                                  <FileText size={16} />
                                </div>
                                <div className="text-right truncate max-w-[140px]">
                                  <p className="text-xs font-extrabold text-slate-800 truncate leading-tight" title={msg.file.name}>
                                    {msg.file.name}
                                  </p>
                                  <span className="text-[9px] text-slate-400 font-bold block mt-0.5">
                                    {formatFileSize(msg.file.size)}
                                  </span>
                                </div>
                              </div>
                              <a 
                                href={msg.file.data} 
                                download={msg.file.name}
                                className="p-2 bg-white text-indigo-600 hover:text-white hover:bg-indigo-600 border border-indigo-200 rounded-xl transition-all shadow-3xs cursor-pointer focus:outline-none"
                              >
                                <Download size={13} />
                              </a>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Text content inside bubble */}
                      {msg.text && (
                        <p className="text-xs leading-relaxed font-semibold whitespace-pre-wrap">
                          {msg.text}
                        </p>
                      )}
                    </div>

                    {/* Timestamp */}
                    <span className="text-[8px] text-slate-400 font-semibold font-mono mt-0.5 px-1 block">
                      {new Date(msg.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* 3. Drag and Drop Overlay Visualizer */}
      <AnimatePresence>
        {isDragging && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-indigo-900/60 backdrop-blur-xs flex flex-col items-center justify-center text-white z-40 p-6 pointer-events-none"
          >
            <div className="w-16 h-16 rounded-full bg-white text-indigo-600 border-4 border-indigo-400/40 flex items-center justify-center mb-3 animate-ping">
              <Paperclip size={28} />
            </div>
            <h3 className="text-lg font-black leading-snug">إفلات الملف للمشاركة الفورية 📎</h3>
            <p className="text-xs text-indigo-200 mt-1 font-semibold">بحد أقصى للحجم يصل إلى 5 ميجابايت كحد أقصى</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 4. Action Tray for selected file draft */}
      <AnimatePresence>
        {attachedFile && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-indigo-50/90 border-t border-indigo-100 p-3.5 z-10 flex items-center justify-between gap-3.5"
          >
            <div className="flex items-center gap-3">
              {attachedFile.type.startsWith('image/') ? (
                <div className="w-12 h-12 rounded-xl overflow-hidden border border-indigo-200 bg-white shadow-3xs shrink-0 select-none">
                  <img src={attachedFile.data} alt="مرفق" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </div>
              ) : (
                <div className="w-12 h-12 rounded-xl bg-white border border-indigo-200 flex items-center justify-center text-indigo-600 shrink-0 shadow-3xs">
                  <File size={20} />
                </div>
              )}
              <div className="text-right">
                <span className="text-[10px] bg-indigo-100 text-indigo-700 py-0.5 px-2 rounded-md font-bold">ملف مرفق جاهز للإرسال 📁</span>
                <h5 className="text-xs font-black text-slate-800 truncate max-w-[200px] sm:max-w-xs mt-1" title={attachedFile.name}>
                  {attachedFile.name}
                </h5>
                <span className="text-[9px] text-slate-450 block font-bold font-mono mt-0.5">
                  الحجم الفعلي: {formatFileSize(attachedFile.size)}
                </span>
              </div>
            </div>

            <button 
              type="button"
              onClick={() => setAttachedFile(null)}
              className="p-1.5 text-slate-500 hover:text-red-650 hover:bg-red-50 bg-white border border-slate-200 rounded-xl transition-all cursor-pointer shadow-3xs"
              title="إلغاء الملف المرفق"
            >
              <X size={15} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 5. Message Input Form */}
      <form 
        onSubmit={handleSendMessage}
        className="bg-white border-t border-slate-200 px-4 py-3.5 flex items-center gap-3"
      >
        {/* Hidden File Picker Input */}
        <input 
          id="chat-file-input"
          type="file"
          className="hidden"
          onChange={handleFileChange}
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
        />

        {/* Paperclip attach trigger */}
        <button 
          type="button"
          onClick={() => document.getElementById('chat-file-input')?.click()}
          className="p-2.5 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-250 text-slate-500 hover:text-indigo-650 rounded-xl transition-all cursor-pointer shrink-0 focus:outline-none shadow-3xs"
          title="إضافة ملف مرفق (واجب، صورة، مستند)"
        >
          <Paperclip size={18} />
        </button>

        {/* Text Input container */}
        <input 
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="اكتب رسالتك أو استفسارك هنا ومشاركته فوراً..."
          className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-550 focus:ring-1 focus:ring-indigo-550 focus:bg-white transition-all duration-250"
        />

        {/* Send Action Button */}
        <button 
          type="submit"
          disabled={!inputText.trim() && !attachedFile}
          className={`p-2.5 rounded-xl transition-all shrink-0 shadow-sm active:scale-95 flex items-center justify-center font-bold ${
            inputText.trim() || attachedFile
              ? 'bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer hover:shadow-indigo-600/20'
              : 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-200/50'
          }`}
          title="إرسال عبر الفضاء الرقمي"
        >
          <Send size={16} className="transform rotate-180" />
        </button>
      </form>

      {/* Lightbox Overlay Image Modal */}
      <AnimatePresence>
        {lightboxImage && (
          <div 
            className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md cursor-zoom-out"
            onClick={() => setLightboxImage(null)}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative max-w-4xl max-h-[90vh] bg-transparent group"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button top-right */}
              <button 
                onClick={() => setLightboxImage(null)}
                className="absolute -top-12 left-0 p-2 text-white/80 hover:text-white bg-white/10 rounded-xl hover:bg-white/20 transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold font-sans"
              >
                <X size={15} />
                <span>إغلاق المعاينة</span>
              </button>
              
              <img 
                src={lightboxImage} 
                alt="معاينة الصورة بكامل دقتها" 
                className="max-w-full max-h-[80vh] object-contain rounded-2xl shadow-2xl border border-white/10" 
                referrerPolicy="no-referrer"
              />
              
              <div className="text-center mt-3 text-white/70 text-xs font-bold leading-normal font-sans py-2 bg-black/40 backdrop-blur-md rounded-xl select-none">
                أمنة ومجفرة سحابياً بنظام النقل المتزامن • يمكنك النقر بالزر الأيمن لحفظ الصورة
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
