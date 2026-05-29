import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route to analyze student attendance logs using Gemini API safely on server-side
  app.post("/api/analyze-student", async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(400).json({ 
          error: "Gemini API Key is not configured. Please add your key in the Secrets panel." 
        });
      }

      const { studentName, sessions } = req.body;

      if (!studentName) {
        return res.status(400).json({ error: "اسم الطالب مطلوب" });
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

      const advice = response.text || "تحليل ممتاز للطالب! يرجى الاستمرار في الحفاظ على وتيرة المتابعة والتشجيع المستمر للواجبات والدروس.";
      return res.json({ advice: advice.trim() });
    } catch (err: any) {
      console.error("Error with Gemini analysis API:", err);
      return res.status(500).json({ 
        error: "فشل استدعاء الذكاء الاصطناعي لتحليل البيانات. يرجى التأكد من صلاحية المفتاح والاتصال." 
      });
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
