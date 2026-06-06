import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import { WebSocketServer, WebSocket } from "ws";

const CHAT_HISTORY_FILE = path.join(process.cwd(), "chat_history.json");
const CHAT_GROUPS_FILE = path.join(process.cwd(), "chat_groups.json");

interface ChatFile {
  name: string;
  type: string;
  size: number;
  data: string; // Base64 Content URI
}

interface ChatMessage {
  id: string;
  studentId: string;
  sender: 'teacher' | 'student';
  senderName?: string;
  text: string;
  timestamp: number;
  file?: ChatFile;
}

interface ChatGroup {
  id: string;
  name: string;
  studentIds: string[];
  createdAt: number;
}

// Memory database for chat messages, loaded from disk
let chatMessagesMemory: ChatMessage[] = [];
let chatGroupsMemory: ChatGroup[] = [];

try {
  if (fs.existsSync(CHAT_HISTORY_FILE)) {
    const data = fs.readFileSync(CHAT_HISTORY_FILE, "utf-8");
    chatMessagesMemory = JSON.parse(data);
    console.log(`Loaded ${chatMessagesMemory.length} chat messages from history file.`);
  } else {
    fs.writeFileSync(CHAT_HISTORY_FILE, JSON.stringify([], null, 2), "utf-8");
  }
} catch (error) {
  console.error("Error reading/writing chat_history.json, resetting to empty array:", error);
}

try {
  if (fs.existsSync(CHAT_GROUPS_FILE)) {
    const data = fs.readFileSync(CHAT_GROUPS_FILE, "utf-8");
    chatGroupsMemory = JSON.parse(data);
    console.log(`Loaded ${chatGroupsMemory.length} chat groups from groups file.`);
  } else {
    fs.writeFileSync(CHAT_GROUPS_FILE, JSON.stringify([], null, 2), "utf-8");
  }
} catch (error) {
  console.error("Error reading/writing chat_groups.json, resetting to empty array:", error);
}

function saveChatHistory() {
  try {
    fs.writeFileSync(CHAT_HISTORY_FILE, JSON.stringify(chatMessagesMemory, null, 2), "utf-8");
  } catch (error) {
    console.error("Failed to save chat history to file:", error);
  }
}

function saveChatGroups() {
  try {
    fs.writeFileSync(CHAT_GROUPS_FILE, JSON.stringify(chatGroupsMemory, null, 2), "utf-8");
  } catch (error) {
    console.error("Failed to save chat groups to file:", error);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '15mb' })); // allow file streams up to 15mb

  // chat history endpoint
  app.get("/api/chat-history/:studentId", (req, res) => {
    const { studentId } = req.params;
    if (!studentId) {
      return res.status(400).json({ error: "معرف الطالب مطلوب" });
    }
    const filtered = chatMessagesMemory.filter(msg => msg.studentId === studentId);
    return res.json({ messages: filtered });
  });

  // Get chat groups list
  app.get("/api/chat-groups", (req, res) => {
    return res.json({ groups: chatGroupsMemory });
  });

  // Create new chat group
  app.post("/api/chat-groups", (req, res) => {
    const { name, studentIds } = req.body;
    if (!name || !Array.isArray(studentIds)) {
      return res.status(400).json({ error: "اسم المجموعة وقائمة مسؤولي الطلاب مطلوبين" });
    }
    const newGroup: ChatGroup = {
      id: `group_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name,
      studentIds,
      createdAt: Date.now()
    };
    chatGroupsMemory.push(newGroup);
    saveChatGroups();
    return res.json({ success: true, group: newGroup });
  });

  // Delete chat group
  app.delete("/api/chat-groups/:groupId", (req, res) => {
    const { groupId } = req.params;
    const initialLength = chatGroupsMemory.length;
    chatGroupsMemory = chatGroupsMemory.filter(g => g.id !== groupId);
    if (chatGroupsMemory.length === initialLength) {
      return res.status(404).json({ error: "المجموعة غير موجودة" });
    }
    // Also optional: clean up group messages
    chatMessagesMemory = chatMessagesMemory.filter(msg => msg.studentId !== groupId);
    saveChatGroups();
    saveChatHistory();
    return res.json({ success: true });
  });

  // Helper function for automatic high-quality rule-based fallback advice when Gemini is unavailable or rate-limited
  function generateSmartFallbackAdvice(studentName: string, sessions: any[]): string {
    if (!sessions || sessions.length === 0) {
      return `مستشار ذكي: لا توجد سجلات حصص مسجلة حتى الآن للطالب ${studentName}. يُنصح بجدولة حصته الأولى لإطلاق خطة تقييم ومتابعة المهارات وتحفيزه مبكراً.`;
    }

    let excellentCount = 0;
    let goodCount = 0;
    let weakCount = 0;
    let hasAbsence = false;

    sessions.forEach((s: any) => {
      if (s.evaluation) {
        if (s.evaluation === "ممتاز" || s.evaluation === "جيد جداً") {
          excellentCount++;
        } else if (s.evaluation === "جيد" || s.evaluation === "مقبول") {
          goodCount++;
        } else if (s.evaluation === "ضعيف") {
          weakCount++;
        }
      }
      if (s.notes && (s.notes.includes("غياب") || s.notes.includes("غائب") || s.notes.includes("تغيب"))) {
        hasAbsence = true;
      }
    });

    if (hasAbsence) {
      return `مستشار ذكي: لوحظ عدم انتظام مؤقت في المواعيد الأخيرة. يُقترح التنسيق السريع مع ولي الأمر وتفعيل تنبيهات تذكيرية بالحصص لضمان الاستمرارية وتجنب فجوات التعلم.`;
    }

    if (excellentCount > goodCount && excellentCount > weakCount) {
      return `مستشار ذكي: يُبدي تفاعلاً وأداءً أكاديمياً استثنائياً ومبهراً في السجلات الأخيرة. يُنصح بمواصلة تشجيعه عبر لوحة التقدم وتقدير تميزه لضمان تحفيزه المستمر.`;
    }

    if (weakCount > 0) {
      return `مستشار ذكي: يُرصد احتياج الطالب لتعزيز بعض المفاهيم التأسيسية. يوصى بتخصيص 10 دقائق مراجعة سريعة قبل الحصة القادمة وبناء روابط دعم فردية لتبسيط الصعوبات.`;
    }

    return `مستشار ذكي: أداء الطالب مستقر تماماً وتفاعله متوازن علمياً وسلوكياً خلال الحصص. يُوصى بالتركيز على التقييمات الإيجابية ودفعه للمشاركة الشفهية لزيادة ثقته بنفسه.`;
  }

  // API Route to analyze student attendance logs using Gemini API safely on server-side
  app.post("/api/analyze-student", async (req, res) => {
    const { studentName, sessions } = req.body;

    if (!studentName) {
      return res.status(400).json({ error: "اسم الطالب مطلوب" });
    }

    const fallbackAdvice = generateSmartFallbackAdvice(studentName, sessions || []);

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        // Return beautiful rule-based fallback advice if API key is not configured yet
        return res.json({ advice: fallbackAdvice, isFallback: true });
      }

      // Initialize the official Gemini SDK
      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      // Construct brief log text for context
      const sessionsText = (sessions || [])
        .slice(-10) // analyze up to the last 10 sessions for efficiency and focus
        .map((s: any, idx: number) => `- الحصة #${idx + 1}: في تاريخ ${s.date} ${s.time ? `الساعة ${s.time}` : ""} ${s.notes ? `[ملاحظات: ${s.notes}]` : ""}`)
        .join("\n");

      // Prompt in Arabic for Arabic result as requested
      const prompt = `أنت مساعد ذكي ومستشار أكاديمي متمرس للمعلمين والمطورين.
بناءً على الاسم وسجلات الحضور والغياب والملاحظات التالية للطالب "${studentName}":

سجلات الحصص الأخيرة:
${sessionsText || "لا توجد سجلات حصص حالياً للطالب."}

الرجاء تحليل هذه البيانات وتقديم نصيحة تربوية وأكاديمية بالغة الاختصار وذكية للمعلم لمعرفة حالة الطالب، أمن حضورًا مستمرًا، أو احتمالية تغيبه عن الحصص القادمة، أو نصيحة ذهبية قصيرة لتحسين التفاعلية.
الشروط:
1. يجب أن تكون النصيحة باللغة العربية.
2. يجب ألا تتجاوز النصيحة جملتين قصيرتين ومباشرتين فقط (بين 20 و 40 كلمة).
3. كن ودوداً وعملياً ومفيداً جداً وبدون مجهود تعبيري مبالغ فيه.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
      });

      const advice = response.text || fallbackAdvice;
      return res.json({ advice: advice.trim(), isFallback: false });
    } catch (err: any) {
      console.warn("Exception in Gemini API (e.g. high-demand 503 or limit), using rule-based fallback advice:", err.message || err);
      // Return beautiful fallback advice without throwing internal server error
      return res.json({ advice: fallbackAdvice, isFallback: true });
    }
  });

  // Serve static assets/frontend
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  const wss = new WebSocketServer({ server });

  // Map to hold connected WebSocket and their metadata
  const activeSockets = new Map<WebSocket, { role: 'teacher' | 'student'; studentId?: string }>();

  wss.on('connection', (ws: WebSocket) => {
    console.log('New WebSocket connection established.');

    ws.on('message', (messageBuffer) => {
      try {
        const payload = JSON.parse(messageBuffer.toString());
        
        if (payload.type === 'register') {
          const { role, studentId } = payload;
          activeSockets.set(ws, { role, studentId });
          console.log(`Socket registered - Role: ${role}, StudentId: ${studentId}`);
        } 
        
        else if (payload.type === 'message') {
          const { studentId, sender, senderName, text, file } = payload;
          if (!studentId || !sender) return;

          const newMessage: ChatMessage = {
            id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            studentId,
            sender,
            senderName: senderName || undefined,
            text: text || '',
            timestamp: Date.now(),
            file: file || undefined
          };

          // Append to server cache and write to file
          chatMessagesMemory.push(newMessage);
          saveChatHistory();

          // Broadcast payload
          const responsePayload = JSON.stringify({ type: 'new_message', message: newMessage });
          
          for (const [socket, meta] of activeSockets.entries()) {
            if (socket.readyState === WebSocket.OPEN) {
              if (studentId.startsWith('group_')) {
                // If group message, send to teacher or any student belonging to that group
                const group = chatGroupsMemory.find(g => g.id === studentId);
                const isGroupMember = group && meta.studentId && group.studentIds.includes(meta.studentId);
                if (meta.role === 'teacher' || isGroupMember) {
                  socket.send(responsePayload);
                }
              } else {
                // Send to matching student or any active teacher
                if (meta.studentId === studentId || meta.role === 'teacher') {
                  socket.send(responsePayload);
                }
              }
            }
          }
        }
      } catch (err) {
        console.error('Error processing WebSocket message:', err);
      }
    });

    ws.on('close', () => {
      activeSockets.delete(ws);
      console.log('WebSocket connection closed.');
    });

    ws.on('error', (err) => {
      console.error('WebSocket error occurred:', err);
      activeSockets.delete(ws);
    });
  });
}

startServer();
