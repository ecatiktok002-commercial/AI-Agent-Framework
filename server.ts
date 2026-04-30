import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/functions/extract-pdf-knowledge", async (req, res) => {
    try {
      const { pdfText, imageUrls, fileName } = req.body;
      const { GoogleGenAI } = await import("@google/genai");
      const { createClient } = await import("@supabase/supabase-js");

      const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
      const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
      const GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

      const supabase = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);
      const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

      const systemInstruction = `You are an expert technical data extractor. Read this manual and extract every factual detail, therapy benefit, and safety rule. 
You are also provided with image URLs representing the pages/diagrams. 
Convert the entire document into a well-structured Markdown document (.md). Ensure headings, lists, and facts are clear. 
If a section or fact is heavily reliant on a visual diagram, embed the image URL directly in the Markdown using standard syntax: ![Diagram](URL). 
Output ONLY valid Markdown text, do not wrap it in JSON.`;

      const parts: any[] = [];
      if (pdfText) {
        parts.push({ text: "PDF Manual Content:\n" + pdfText });
      }

      if (imageUrls && imageUrls.length > 0) {
        for (const url of imageUrls) {
          parts.push({
            text: `Page/Diagram Image URL: ${url}`
          });
        }
      }

      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [{ role: "user", parts }],
        config: {
          systemInstruction,
        }
      });

      const markdownText = response.text || "";

      const insertPayload = {
        file_name: fileName || "Imported_Manual.pdf",
        content_markdown: markdownText,
        status: 'pending'
      };

      const { data, error } = await supabase.from('pdf_documents').insert([insertPayload]).select();
      if (error) throw error;

      res.status(200).json({ success: true, data: data });
    } catch (error: any) {
      console.error("Error extracting PDF:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/functions/export-pdf-knowledge", async (req, res) => {
    try {
      const { documentId } = req.body;
      const { GoogleGenAI, Type } = await import("@google/genai");
      const { createClient } = await import("@supabase/supabase-js");

      if (!documentId) {
        throw new Error("documentId is required");
      }

      const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
      const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
      const GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

      const supabase = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);

      const { data: doc, error: docError } = await supabase.from('pdf_documents').select('*').eq('id', documentId).single();
      if (docError) throw docError;
      if (!doc) throw new Error("Document not found");

      const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
      const systemInstruction = `You are a strict data structuring assistant. I will provide you with a Markdown document detailing a health equipment manual. 
You must break down this Markdown into discrete, factual pieces of knowledge. 
Extract EVERY factual detail, therapy benefit, pricing, and safety rule from the text.
If there are image URLs embedded like ![Diagram](URL), attach the EXACT matching image URL to the corresponding fact.
Identify the overarching "product_name" for these facts from the document.
Output STRICTLY as a JSON array with exactly these keys: "product_name", "category", "topic", "fact", and "image_url" (can be null).`;

      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [{ role: "user", parts: [{ text: doc.content_markdown }] }],
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                product_name: { type: Type.STRING },
                category: { type: Type.STRING },
                topic: { type: Type.STRING },
                fact: { type: Type.STRING },
                image_url: { type: Type.STRING, nullable: true }
              },
              required: ["product_name", "category", "topic", "fact"]
            }
          }
        }
      });

      const parsedData = JSON.parse(response.text || "[]");

      const insertPayload = parsedData.map((item: any) => {
        const payload: any = {
          product_name: item.product_name,
          category: item.category,
          topic: item.topic,
          fact: item.fact,
          is_active: true
        };
        if (item.image_url) {
          payload.image_url = item.image_url;
        }
        return payload;
      });

      if (insertPayload.length > 0) {
        const { error } = await supabase.from('company_knowledge').insert(insertPayload);
        if (error) throw error;
      }

      const { error: updateError } = await supabase.from('pdf_documents').update({ status: 'exported' }).eq('id', documentId);
      if (updateError) throw updateError;

      res.status(200).json({ success: true, count: insertPayload.length });
    } catch (error: any) {
      console.error("Error exporting PDF:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    
    const fs = await import('fs');
    
    // Inject __ENV__ into the HTML served by Vite
    app.use('*', async (req, res, next) => {
      try {
        if (req.originalUrl.includes('.') && !req.originalUrl.endsWith('.html')) {
           return next();
        }
        let template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(req.originalUrl, template);
        const envScript = `<script>window.__ENV__ = { VITE_SUPABASE_URL: "${process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''}", VITE_SUPABASE_ANON_KEY: "${process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''}" };</script>`;
        const html = template.replace('</head>', `${envScript}</head>`);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });

    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    const fs = await import('fs');
    app.use(express.static(distPath, { index: false }));
    app.get('*', (req, res) => {
      try {
        let html = fs.readFileSync(path.join(distPath, 'index.html'), 'utf-8');
        const envScript = `<script>window.__ENV__ = { VITE_SUPABASE_URL: "${process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''}", VITE_SUPABASE_ANON_KEY: "${process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''}" }</script>`;
        html = html.replace('</head>', `${envScript}</head>`);
        res.send(html);
      } catch (err) {
        console.error("Error serving index.html:", err);
        res.status(500).send("Server Error");
      }
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
