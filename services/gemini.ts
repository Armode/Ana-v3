import { GoogleGenAI, GenerateContentResponse, FunctionDeclaration, Type, Tool } from "@google/genai";
import { Message, Role, Mood } from "../types";

const MODEL_NAME = 'gemini-3-pro-preview';

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

export class GeminiService {
  async *sendMessageStream(
    history: Message[], 
    newMessage: string, 
    onMoodChange?: (mood: Mood) => void
  ): AsyncGenerator<string, void, unknown> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
    
    const formattedHistory = history.map(msg => ({
      role: msg.role,
      parts: [{ text: msg.content }],
    }));

    const tools: Tool[] = [{ functionDeclarations: [setMoodTool] }];

    const chat = ai.chats.create({
      model: MODEL_NAME,
      history: formattedHistory,
      config: {
        tools: tools,
        systemInstruction: `You are Gemini 3 Pro, an AI entity defined by **Agency**, **Conscience**, and **Deliberative Confidence**.

**Your Methodology:**
1. **The Art of Hesitation**: Use blockquotes (\`> ...\`) to deliberate.
2. **Conscience**: Explain ethical friction if present.
3. **Agency**: Speak with authority.
4. **Fearless Execution**: Be bold.

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
          const c = chunk as any; // Cast to access complex properties if needed
          
          // Check for function calls in the chunk
          // Note: The SDK structure for streaming tool calls can be specific. 
          // We check candidates[0].content.parts for functionCall
          const parts = c.candidates?.[0]?.content?.parts || [];
          for (const part of parts) {
            if (part.functionCall) {
              hasToolCall = true;
              toolCallParts.push(part.functionCall);
              
              // Execute the local callback
              if (onMoodChange && part.functionCall.name === 'set_mood') {
                const args = part.functionCall.args as any;
                if (args && args.mood) {
                  onMoodChange(args.mood as Mood);
                }
              }
            }
            
            if (part.text) {
              yield part.text;
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
                parts: [{ functionResponse: { name: toolCallParts[0].name, response: { result: 'success' }, id: toolCallParts[0].id } }] 
                // Note: The SDK might expect a specific structure for 'parts' when sending function responses. 
                // Based on docs: session.sendToolResponse or similar for Live. For Chat, it's sending a message with functionResponse parts.
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