import { GoogleGenAI } from '@google/genai';

// Initialize the Google GenAI SDK
// It automatically picks up GEMINI_API_KEY from process.env
const ai = new GoogleGenAI({});

export interface PerceptionResult {
  x?: number;
  y?: number;
  action: 'click' | 'click_element' | 'swipe' | 'type' | 'long_press' | 'done' | 'rescue';
  start_x?: number;
  start_y?: number;
  end_x?: number;
  end_y?: number;
  text?: string;
  semantic_text?: string;
  resource_id?: string;
  reasoning: string;
}

export class PerceptionEngine {
  /**
   * Optionally prune the XML to save tokens by removing non-essential attributes
   * like password, checkable, checked, etc.
   */
  private pruneXml(xmlDump: string): string {
    return xmlDump
      .replace(/ password="(true|false)"/g, '')
      .replace(/ checkable="(true|false)"/g, '')
      .replace(/ checked="(true|false)"/g, '')
      .replace(/ focusable="(true|false)"/g, '')
      .replace(/ focused="(true|false)"/g, '')
      .replace(/ scrollable="(true|false)"/g, '')
      .replace(/ long-clickable="(true|false)"/g, '')
      .replace(/ selected="(true|false)"/g, '');
  }

  public async resolveTarget(goal: string, xmlDump: string, imageBase64?: string, history: string[] = []): Promise<PerceptionResult> {
    const prunedXml = this.pruneXml(xmlDump);

    const systemPrompt = `You are the Dynamic Perception Engine for an Android Edge Automation framework.
Your task is to analyze the provided XML UI dump and optional screenshot, review the past action history, and decide on the NEXT optimal action to accomplish the user's goal.
If the goal is achieved, output action "done".
If an unexpected popup, OS modal, or permission dialog is completely blocking the screen and preventing you from achieving the goal, output action "rescue".
The XML elements have a \`bounds="[left,top][right,bottom]"\` attribute. Calculate center points for clicking.

Return your response as a valid JSON object matching this schema:
{
  "action": "click" | "click_element" | "swipe" | "type" | "long_press" | "done" | "rescue",
  "x": number, // Required if action is "click" (fallback)
  "y": number, // Required if action is "click" (fallback)
  "semantic_text": string, // Required if action is "click_element" (Preferred! Provide the exact text to click)
  "resource_id": string, // Optional if action is "click_element" (Preferred over x/y if possible)
  "start_x": number, // Required if action is "swipe"
  "start_y": number, // Required if action is "swipe"
  "end_x": number, // Required if action is "swipe"
  "end_y": number, // Required if action is "swipe"
  "text": string, // Required if action is "type"
  "reasoning": "Brief explanation of why you chose this element or action"
}`;

    const userPrompt = `Goal: ${goal}
Action History:
${history.length > 0 ? history.join('\n') : "None"}

XML UI Dump:
${prunedXml}`;

    const contents: any[] = [{ text: userPrompt }];

    if (imageBase64) {
      contents.push({
        inlineData: {
          mimeType: 'image/png',
          data: imageBase64
        }
      });
    }

    try {
      // 1. Try Primary Cloud API (Gemini Vision)
      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: [
            {
                role: 'user',
                parts: contents
            }
        ],
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: 'application/json',
          temperature: 0.1
        }
      });

      const responseText = response.text;
      if (!responseText) {
          throw new Error("No response from AI");
      }
      
      const parsed = JSON.parse(responseText);
      return this.mapResult(parsed);

    } catch (geminiError) {
      console.warn("[PerceptionEngine] Gemini API failed (likely rate limit). Falling back to Local LLM...", geminiError.message);
      
      // 2. Fallback to Local API (Ollama Text-Only)
      try {
        const response = await fetch('http://localhost:11434/api/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'qwen2.5-coder:14b', // Using local text model
            system: systemPrompt,
            prompt: userPrompt, // Notice we don't send the image here
            stream: false,
            format: 'json',
            options: {
              temperature: 0.1
            }
          }),
        });

        if (!response.ok) {
          throw new Error(`Ollama API Error: ${response.statusText}`);
        }

        const data = await response.json();
        const responseText = data.response;
        
        if (!responseText) {
            throw new Error("No response from Local AI");
        }
        
        const parsed = JSON.parse(responseText);
        return this.mapResult(parsed);
      } catch (ollamaError) {
        console.error("[PerceptionEngine] Local LLM Fallback also failed:", ollamaError);
        throw ollamaError;
      }
    }
  }

  private mapResult(parsed: any): PerceptionResult {
    return {
      action: parsed.action,
      x: parsed.x,
      y: parsed.y,
      semantic_text: parsed.semantic_text,
      resource_id: parsed.resource_id,
      start_x: parsed.start_x,
      start_y: parsed.start_y,
      end_x: parsed.end_x,
      end_y: parsed.end_y,
      text: parsed.text,
      reasoning: parsed.reasoning
    };
  }
}

export const perceptionEngine = new PerceptionEngine();
