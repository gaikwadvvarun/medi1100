
import { GoogleGenAI, Type } from "@google/genai";
import { TriageResponse, MedicineInfo, Appointment } from "../types";

export async function performTriage(symptoms: string): Promise<TriageResponse> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analyze these symptoms and provide medical triage advice: "${symptoms}"`,
      config: {
        systemInstruction: "You are a professional medical triage assistant. You help patients identify the correct doctor specialization based on symptoms. Be helpful but always remind them you are an AI and they should consult a professional in emergencies. Return data in JSON format.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            recommendedSpecialization: { type: Type.STRING },
            urgency: { type: Type.STRING, enum: ['Low' as any, 'Medium' as any, 'High' as any] },
            explanation: { type: Type.STRING },
            possibleQuestions: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["recommendedSpecialization", "urgency", "explanation", "possibleQuestions"]
        }
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("AI returned an empty response.");
    }

    return JSON.parse(text) as TriageResponse;
  } catch (e: any) {
    console.error("Gemini API Error:", e);
    if (e.message?.includes("Requested entity was not found")) {
      if (typeof window !== 'undefined' && (window as any).aistudio?.openSelectKey) {
        await (window as any).aistudio.openSelectKey();
      }
    }
    throw new Error("AI Triage is currently unavailable.");
  }
}

export async function getMedicineInfo(query: string): Promise<MedicineInfo> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Explain this medicine or prescription in simple terms: "${query}"`,
      config: {
        systemInstruction: "You are a medical pharmacology assistant. Explain medicines simply to patients. Include what it is, how to use it, common side effects, and important precautions. Be accurate but always add a disclaimer. Return in JSON format.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            whatIsIt: { type: Type.STRING },
            instructions: { type: Type.ARRAY, items: { type: Type.STRING } },
            sideEffects: { type: Type.ARRAY, items: { type: Type.STRING } },
            precautions: { type: Type.STRING }
          },
          required: ["name", "whatIsIt", "instructions", "sideEffects", "precautions"]
        }
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("AI returned an empty response.");
    }

    return JSON.parse(text) as MedicineInfo;
  } catch (e: any) {
    console.error("Gemini Pharmacy Error:", e);
    throw new Error("Unable to fetch medicine details at this time.");
  }
}

export async function chatWithHealthAssistant(
  message: string, 
  history: Appointment[], 
  chatLog: {role: 'user' | 'model', text: string}[]
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const historySummary = history.map(app => 
    `- Date: ${app.appointmentDate}, Doctor: ${app.doctorName}, Problem: ${app.patientProblem}, Notes: ${app.doctorNotes || 'N/A'}, Status: ${app.healthStatus}`
  ).join('\n');

  const systemInstruction = `You are the MediQ Health Assistant. Your goal is to help patients "restore" their understanding of their medical journey by answering questions about their history.
  
  Patient Medical History:
  ${historySummary || "No previous records found."}

  Rules:
  1. Use the provided history to answer specific questions.
  2. Be empathetic and professional.
  3. If asked about something not in the history, answer generally but prioritize the patient's context.
  4. Always remind them that you are an AI and to consult their actual doctor for changes in treatment.
  5. Keep responses concise and formatted with markdown if needed.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        ...chatLog.map(m => ({ parts: [{ text: m.text }], role: m.role })),
        { parts: [{ text: message }], role: 'user' }
      ],
      config: {
        systemInstruction,
        temperature: 0.7,
      }
    });

    return response.text || "I'm sorry, I couldn't generate a response.";
  } catch (e: any) {
    console.error("Health Assistant Error:", e);
    throw new Error("AI Assistant is currently resting. Please try again later.");
  }
}
