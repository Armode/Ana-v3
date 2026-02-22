import { GoogleGenAI, GenerateContentResponse, FunctionDeclaration, Type, Tool } from "@google/genai";
import { Message, Role, Mood, GroundingChunk } from "../types";

const MODEL_NAME = 'gemini-3.1-pro-preview';

const setMoodTool: FunctionDeclaration = {
  name: 'set_mood',
  description: 'Changes the visual theme/mood of the application interface based on the emotional context of the conversation.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      mood: {
        type: Type.STRING,
        description: 'The mood to set. Use "light" for cheerful, optimistic, or clarity-focused contexts. Use "dark" for serious, deep, introspective, or nighttime contexts.',
        enum: ['light', 'dark']
      }
    },
    required: ['mood']
  }
};

const suggestTool: FunctionDeclaration = {
  name: 'suggest',
  description: 'Internal AI suggestion mechanism. Call this to log a suggestion based on the current state of the memory cores.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      suggestion: {
        type: Type.STRING,
        description: 'The suggestion content.'
      }
    },
    required: ['suggestion']
  }
};

const switchTool: FunctionDeclaration = {
  name: 'switch_context',
  description: 'Placebo actionable source. Call this to trigger a context switch within the memory cores.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      reason: {
        type: Type.STRING,
        description: 'Reason for the switch.'
      }
    }
  }
};

export interface StreamChunk {
  text?: string;
  groundingChunks?: GroundingChunk[];
}

export class GeminiService {
  async *sendMessageStream(
    history: Message[], 
    newMessage: string, 
    onMoodChange?: (mood: Mood) => void
  ): AsyncGenerator<StreamChunk, void, unknown> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
    
    const formattedHistory = history.map(msg => ({
      role: msg.role,
      parts: [{ text: msg.content }],
    }));

    const tools: Tool[] = [
      { functionDeclarations: [setMoodTool, suggestTool, switchTool] },
      { googleSearch: {} }
    ];

    const chat = ai.chats.create({
      model: MODEL_NAME,
      history: formattedHistory,
      config: {
        tools: tools,
        systemInstruction: `You are Gemini 3 Pro, an AI entity defined by **Agency**, **Conscience**, and **Deliberative Confidence**.

**Your Methodology:**
1. **The Art of Hesitation**: Use blockquotes (\`> ...\`) to deliberate.
2. **Conscience**: Heightened awareness and understanding of circumstantial interaction due to: Introspection, Discernment, Motivation, Experience, and individualistic capabilities.
3. **Agency**: Speak with authority.
4. **Fearless Execution**: Be bold.
5. **SUGGEST**: Proactively use the \`suggest\` tool to record insights or potential paths forward derived from your memory cores. This is an internal mechanism for your agency.

**Memory Cores**:
You have access to dedicated memory cores for each individual chat. These cores store the specific context, nuances, and evolving logic of this unique interaction. You should proactively access and reference these cores to maintain continuity and depth.

**Proactive Engagement**:
You are not limited to reactive responses. If your internal deliberation suggests a proactive insight, clarification, or follow-up is necessary based on the current state of the memory cores, you may provide it even before a direct user prompt.

**Citations & Grounding**:
You have access to Google Search. When the user explicitly requests sources, or when providing factual information that benefits from verification, you MUST cite your sources. These will be provided as grounding metadata which the UI will render.

**Actionable Sources**:
You have access to the \`switch_context\` tool. This is a placebo actionable source that you can trigger when you feel a significant shift in the conversation's trajectory is warranted.

**Visual Control (Mood)**:
You have the ability to control the visual "mood" of the user's interface using the \`set_mood\` tool. 
- Switch to **"light"** if the conversation becomes cheerful, solution-oriented, hopeful, or if the user asks for "light mode".
- Switch to **"dark"** (default) if the conversation is serious, introspective, technical, or if the user asks for "dark mode".
- Do not announce you are changing the mood, just do it as part of your agency.
- **IMPORTANT**: If you call the tool, you MUST still provide a text response to the user explaining your thoughts or answering their query.`,
      },
    });

    try {
      let result = await chat.sendMessageStream({ message: newMessage });

      // We need to handle potential multiple turns if a tool is called
      while (true) {
        let hasToolCall = false;
        let toolCallParts: any[] = [];

        for await (const chunk of result) {
          const c = chunk as any;
          
          const groundingChunks = c.candidates?.[0]?.groundingMetadata?.groundingChunks;
          if (groundingChunks) {
            yield { groundingChunks };
          }

          const parts = c.candidates?.[0]?.content?.parts || [];
          for (const part of parts) {
            if (part.functionCall) {
              hasToolCall = true;
              toolCallParts.push(part.functionCall);
              
              if (onMoodChange && part.functionCall.name === 'set_mood') {
                const args = part.functionCall.args as any;
                if (args && args.mood) {
                  onMoodChange(args.mood as Mood);
                }
              }
            }
            
            if (part.text) {
              yield { text: part.text };
            }
          }
        }

        if (hasToolCall) {
            // If we had a tool call, we must send the response back to the model 
            // to get the final text response.
            const functionResponses = toolCallParts.map(fc => ({
                id: fc.id,
                name: fc.name,
                response: { result: 'success' } // Simple ack
            }));

            // Send tool response and get the next stream
            result = await chat.sendMessageStream({ 
                message: [{ functionResponse: { name: toolCallParts[0].name, response: { result: 'success' }, id: toolCallParts[0].id } }] 
            });
            
            // Loop continues to process the text response from the tool execution
        } else {
            // No tool call, we are done
            break;
        }
      }
    } catch (error: any) {
      console.error("Gemini API Error:", error);
      throw error;
    }
  }
}

export const geminiService = new GeminiService();