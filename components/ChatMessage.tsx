import React from 'react';
import { Message, Role, Mood } from '../types';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

// Declare global hljs from the script tag
declare const hljs: any;

interface ChatMessageProps {
  message: Message;
  density: 'comfortable' | 'compact';
  mood: Mood;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message, density, mood }) => {
  const isUser = message.role === Role.USER;
  const isCompact = density === 'compact';
  const isLight = mood === 'light';

  // Dynamic Classes
  const botAvatarBg = isLight ? 'bg-white border border-slate-200' : 'bg-slate-800 border border-slate-700';
  const botIconColor = isLight ? 'text-indigo-600' : 'text-white';
  const botBubbleBg = isLight ? 'bg-white border border-slate-200 text-slate-800' : 'bg-slate-900 border border-slate-800 text-slate-200';
  const timeColor = isLight ? 'text-slate-400' : 'text-slate-500';
  
  // Prose classes: prose-invert is for dark mode, no class for light mode (default tailwind typography)
  const proseClass = isLight ? 'prose prose-slate' : 'prose prose-invert';
  const codeBlockBg = isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#282c34] border-slate-700';
  const codeHeaderBg = isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-800 border-slate-700';
  const codeText = isLight ? 'text-slate-600' : 'text-slate-400';

  const renderContent = () => {
    if (message.role === Role.MODEL && !message.content && message.isStreaming) {
      return (
        <div className="flex items-center space-x-1 h-6">
          <div className={`w-2 h-2 rounded-full animate-bounce ${isLight ? 'bg-slate-400' : 'bg-slate-500'}`} style={{ animationDelay: '0ms' }}></div>
          <div className={`w-2 h-2 rounded-full animate-bounce ${isLight ? 'bg-slate-400' : 'bg-slate-500'}`} style={{ animationDelay: '150ms' }}></div>
          <div className={`w-2 h-2 rounded-full animate-bounce ${isLight ? 'bg-slate-400' : 'bg-slate-500'}`} style={{ animationDelay: '300ms' }}></div>
        </div>
      );
    }

    // Regex to split by code blocks: ```lang\ncode```
    const parts = message.content.split(/```([a-zA-Z0-9+#\-\.]*)\n([\s\S]*?)```/g);

    return parts.map((part, index) => {
      if (index % 3 === 0) {
        // Text part
        if (!part) return null;
        
        const htmlContent = DOMPurify.sanitize(marked.parse(part) as string);
        
        return (
           <div 
             key={index} 
             className={`${proseClass} max-w-none break-words leading-relaxed ${isCompact ? 'prose-sm' : 'prose-base'}`}
             dangerouslySetInnerHTML={{ __html: htmlContent }}
           />
        );
      }
      
      if (index % 3 === 2) {
        // Code part
        const lang = parts[index - 1] || 'plaintext';
        const code = part;
        const displayCode = code.endsWith('\n') ? code.slice(0, -1) : code;
        
        let highlighted = displayCode;
        if (typeof hljs !== 'undefined') {
            try {
                const validLang = hljs.getLanguage(lang) ? lang : 'plaintext';
                highlighted = hljs.highlight(displayCode, { language: validLang }).value;
            } catch (e) {
                // Fallback to plain text if highlighting fails
            }
        }
        
        return (
          <div key={index} className={`my-2 sm:my-4 rounded-lg overflow-hidden shadow-md border not-prose text-sm ${codeBlockBg}`}>
             <div className={`flex items-center justify-between px-3 py-1.5 border-b ${codeHeaderBg}`}>
                <span className={`text-xs font-mono font-medium lowercase ${codeText}`}>{lang || 'text'}</span>
                <button 
                  onClick={() => navigator.clipboard.writeText(displayCode)}
                  className={`${codeText} hover:text-indigo-500 transition-colors`}
                  title="Copy code"
                >
                  <i className="fas fa-copy text-xs"></i>
                </button>
             </div>
             <pre className="p-3 overflow-x-auto custom-scrollbar m-0">
               <code 
                 className="font-mono text-xs sm:text-sm leading-relaxed"
                 dangerouslySetInnerHTML={{ __html: highlighted }}
               />
             </pre>
          </div>
        );
      }
      
      return null;
    });
  };

  return (
    <div className={`flex items-start space-x-2 sm:space-x-4 ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`}>
      {/* Avatar */}
      <div className={`shrink-0 flex items-center justify-center shadow-lg transition-all ${
        isCompact ? 'w-6 h-6 rounded-md text-[10px]' : 'w-8 h-8 rounded-lg text-xs'
      } ${
        isUser ? 'bg-indigo-500' : botAvatarBg
      }`}>
        <i className={`fas ${isUser ? 'fa-user text-white' : `fa-robot ${botIconColor}`}`}></i>
      </div>

      {/* Content */}
      <div className={`flex flex-col max-w-[90%] sm:max-w-[85%] min-w-[50%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div className={`shadow-sm w-full transition-all ${
          isCompact ? 'px-3 py-2 rounded-lg' : 'px-4 py-3 rounded-2xl'
        } ${
          isUser 
            ? 'bg-indigo-600 text-white rounded-tr-none' 
            : `${botBubbleBg} rounded-tl-none`
        }`}>
          {renderContent()}
        </div>
        <span className={`text-[10px] mt-1 uppercase tracking-wider font-semibold opacity-70 ${timeColor}`}>
          {new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit' }).format(message.timestamp)}
        </span>
        
        {/* Grounding / Citations */}
        {message.groundingChunks && message.groundingChunks.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-200/10 w-full">
            <div className={`text-[10px] uppercase tracking-widest font-bold mb-2 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
              Sources & Citations
            </div>
            <div className="flex flex-wrap gap-2">
              {message.groundingChunks.map((chunk, idx) => chunk.web && (
                <a 
                  key={idx}
                  href={chunk.web.uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center space-x-2 text-[11px] px-2 py-1 rounded-md border transition-all ${
                    isLight 
                      ? 'bg-slate-50 border-slate-200 text-indigo-600 hover:bg-slate-100' 
                      : 'bg-slate-800 border-slate-700 text-indigo-400 hover:bg-slate-700'
                  }`}
                >
                  <i className="fas fa-link text-[9px]"></i>
                  <span className="truncate max-w-[150px]">{chunk.web.title || 'Source'}</span>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatMessage;
