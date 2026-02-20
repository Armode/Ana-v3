
import React, { useState, useRef, useEffect } from 'react';
import { Mood } from '../types';

interface ChatInputProps {
  onSend: (content: string) => void;
  disabled?: boolean;
  density?: 'comfortable' | 'compact';
  mood: Mood;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSend, disabled, density = 'comfortable', mood }) => {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isCompact = density === 'compact';
  const isLight = mood === 'light';

  // Dynamic Classes
  const containerClass = isLight 
    ? 'bg-slate-100 border-slate-200 focus-within:bg-white focus-within:border-indigo-300 focus-within:ring-indigo-100' 
    : 'bg-slate-900 border-slate-800 focus-within:border-indigo-500/50 focus-within:ring-indigo-500/10';
  
  const textClass = isLight ? 'text-slate-800 placeholder:text-slate-400' : 'text-slate-200';
  
  const buttonActive = isLight 
    ? 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-indigo-200' 
    : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-indigo-600/20';
    
  const buttonDisabled = isLight ? 'bg-slate-200 text-slate-400' : 'bg-slate-800 text-slate-500';

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (input.trim() && !disabled) {
      onSend(input.trim());
      setInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  return (
    <form onSubmit={handleSubmit} className="relative group">
      <div className={`relative flex items-end w-full border rounded-2xl focus-within:ring-4 transition-all duration-200 ${containerClass} ${isCompact ? 'rounded-xl' : 'rounded-2xl'}`}>
        <textarea
          ref={textareaRef}
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask me anything..."
          disabled={disabled}
          className={`w-full bg-transparent resize-none focus:outline-none custom-scrollbar max-h-[200px] ${textClass} ${
            isCompact ? 'py-3 pl-3 pr-14 text-sm min-h-[46px]' : 'py-4 pl-4 pr-16 text-base min-h-[56px]'
          }`}
        />
        
        <div className={`absolute right-2 ${isCompact ? 'bottom-1.5' : 'bottom-2'}`}>
          <button
            type="submit"
            disabled={!input.trim() || disabled}
            className={`flex items-center justify-center transition-all duration-200 shadow-lg ${
              isCompact ? 'w-8 h-8 rounded-lg' : 'w-10 h-10 rounded-xl'
            } ${
              input.trim() && !disabled
                ? buttonActive
                : `${buttonDisabled} cursor-not-allowed shadow-none`
            }`}
          >
            <i className={`fas ${disabled ? 'fa-spinner fa-spin' : 'fa-paper-plane'} ${isCompact ? 'text-xs' : 'text-sm'}`}></i>
          </button>
        </div>
      </div>
      
      {/* Visual background glow for the active group */}
      <div className={`absolute -inset-1 rounded-3xl blur opacity-0 group-focus-within:opacity-100 transition duration-500 -z-10 ${isLight ? 'bg-indigo-200/50' : 'bg-gradient-to-r from-indigo-500/20 to-purple-500/20'}`}></div>
    </form>
  );
};

export default ChatInput;
