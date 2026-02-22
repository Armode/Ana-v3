
import React, { useState, useEffect, useRef } from 'react';
import { Message, Role, Mood, ChatSession, GroundingChunk } from './types';
import { geminiService, StreamChunk } from './services/gemini';
import ChatMessage from './components/ChatMessage';
import ChatInput from './components/ChatInput';

export interface ViewConfig {
  density: 'comfortable' | 'compact';
  width: 'standard' | 'wide' | 'full';
}

const App: React.FC = () => {
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([
    {
      id: 'initial',
      title: 'New Conversation',
      messages: [
        {
          id: 'welcome',
          role: Role.MODEL,
          content: "Hello! I'm Gemini 3 Pro. How can I help you today?",
          timestamp: new Date(),
        }
      ],
      createdAt: new Date(),
    }
  ]);
  const [activeSessionId, setActiveSessionId] = useState<string>('initial');
  const [isTyping, setIsTyping] = useState(false);
  const [viewConfig, setViewConfig] = useState<ViewConfig>({
    density: 'comfortable',
    width: 'standard'
  });
  const [showSettings, setShowSettings] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [mood, setMood] = useState<Mood>('dark');
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0];
  const messages = activeSession.messages;

  useEffect(() => {
    const checkKey = async () => {
      const aistudio = (window as any).aistudio;
      if (aistudio) {
        try {
          const selected = await aistudio.hasSelectedApiKey();
          setHasKey(selected);
        } catch (err) {
          console.error("Error checking API key status:", err);
          setHasKey(true);
        }
      } else {
        setHasKey(true);
      }
    };
    checkKey();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping, viewConfig]);

  const handleOpenKeyDialog = async () => {
    const aistudio = (window as any).aistudio;
    if (aistudio) {
      try {
        await aistudio.openSelectKey();
        setHasKey(true);
      } catch (err) {
        console.error("Error opening key dialog:", err);
      }
    }
  };

  const handleMoodChange = (newMood: Mood) => {
    console.log("Agent setting mood to:", newMood);
    setMood(newMood);
  };

  const createNewSession = () => {
    const newSession: ChatSession = {
      id: Date.now().toString(),
      title: 'New Conversation',
      messages: [
        {
          id: 'welcome-' + Date.now(),
          role: Role.MODEL,
          content: "Hello! I'm Gemini 3 Pro. How can I help you today?",
          timestamp: new Date(),
        }
      ],
      createdAt: new Date(),
    };
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
  };

  const deleteSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (sessions.length === 1) {
      createNewSession();
      setSessions(prev => prev.filter(s => s.id !== id));
      return;
    }
    setSessions(prev => prev.filter(s => s.id !== id));
    if (activeSessionId === id) {
      setActiveSessionId(sessions.find(s => s.id !== id)?.id || sessions[0].id);
    }
  };

  const handleSendMessage = async (content: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      role: Role.USER,
      content,
      timestamp: new Date(),
    };

    // Update session title if it's the first message
    if (messages.length === 1 && messages[0].id.startsWith('welcome')) {
      setSessions(prev => prev.map(s => 
        s.id === activeSessionId ? { ...s, title: content.slice(0, 30) + (content.length > 30 ? '...' : '') } : s
      ));
    }

    setSessions(prev => prev.map(s => 
      s.id === activeSessionId ? { ...s, messages: [...s.messages, userMessage] } : s
    ));

    setIsTyping(true);

    const botMessageId = (Date.now() + 1).toString();
    const botMessage: Message = {
      id: botMessageId,
      role: Role.MODEL,
      content: '',
      timestamp: new Date(),
      isStreaming: true,
      groundingChunks: []
    };

    setSessions(prev => prev.map(s => 
      s.id === activeSessionId ? { ...s, messages: [...s.messages, botMessage] } : s
    ));

    try {
      let accumulatedResponse = '';
      let accumulatedGrounding: GroundingChunk[] = [];
      
      const stream = geminiService.sendMessageStream(messages, content, handleMoodChange);

      for await (const chunk of stream) {
        if (chunk.text) {
          accumulatedResponse += chunk.text;
        }
        if (chunk.groundingChunks) {
          accumulatedGrounding = [...accumulatedGrounding, ...chunk.groundingChunks];
        }

        setSessions(prev => prev.map(s => 
          s.id === activeSessionId ? {
            ...s,
            messages: s.messages.map(msg => 
              msg.id === botMessageId 
                ? { ...msg, content: accumulatedResponse, groundingChunks: accumulatedGrounding } 
                : msg
            )
          } : s
        ));
      }
      
      setSessions(prev => prev.map(s => 
        s.id === activeSessionId ? {
          ...s,
          messages: s.messages.map(msg => 
            msg.id === botMessageId 
              ? { ...msg, isStreaming: false } 
              : msg
          )
        } : s
      ));
    } catch (error: any) {
      console.error("Chat Error:", error);

      let rawErrorMessage = "";
      let errorCode = 0;
      let errorStatus = "";

      if (error && typeof error === 'object') {
        if (error.error) {
           rawErrorMessage = error.error.message || "";
           errorCode = error.error.code;
           errorStatus = error.error.status;
        } else if (error.message) {
           rawErrorMessage = error.message;
        } else {
           rawErrorMessage = JSON.stringify(error);
        }
      } else {
        rawErrorMessage = String(error);
      }

      const isEntityNotFoundError = rawErrorMessage.includes("Requested entity was not found");
      const isQuotaError = 
        errorCode === 429 || 
        errorStatus === 'RESOURCE_EXHAUSTED' || 
        rawErrorMessage.toLowerCase().includes('quota') || 
        rawErrorMessage.includes('429');

      if (isEntityNotFoundError) {
        setHasKey(false);
        const aistudio = (window as any).aistudio;
        if (aistudio) {
          await aistudio.openSelectKey();
          setHasKey(true);
        }
      }

      let userDisplayMessage = "Sorry, I encountered an error. Please try again.";
      
      if (isQuotaError) {
        userDisplayMessage = "⚠️ **Quota Exceeded**\n\nThe API key has exceeded its rate limit or quota. This often happens with shared keys.\n\nPlease click **Update API Key** in the top right to use your own Google Cloud Project key with billing enabled.";
      } else if (isEntityNotFoundError) {
        userDisplayMessage = "API Key error. Please re-select your key.";
      }

      setSessions(prev => prev.map(s => 
        s.id === activeSessionId ? {
          ...s,
          messages: s.messages.map(msg => 
            msg.id === botMessageId 
              ? { ...msg, content: userDisplayMessage, isStreaming: false } 
              : msg
          )
        } : s
      ));
    } finally {
      setIsTyping(false);
    }
  };

  const getContainerMaxWidth = () => {
    switch(viewConfig.width) {
      case 'wide': return 'max-w-6xl';
      case 'full': return 'max-w-none mx-4';
      default: return 'max-w-4xl';
    }
  };

  // Theme Classes Logic
  const isLight = mood === 'light';
  const bgClass = isLight ? 'bg-slate-50' : 'bg-slate-950';
  const sidebarBgClass = isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800';
  const headerClass = isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800';
  const textClass = isLight ? 'text-slate-800' : 'text-slate-200';
  const subTextClass = isLight ? 'text-slate-500' : 'text-slate-400';
  const buttonHoverClass = isLight ? 'hover:bg-slate-100' : 'hover:bg-slate-800';
  const inputContainerClass = isLight ? 'bg-white border-slate-200' : 'bg-slate-950 border-slate-800';
  const settingsBgClass = isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-700';

  if (hasKey === false) {
    return (
      <div className={`flex flex-col items-center justify-center h-[100dvh] p-6 text-center ${bgClass}`}>
        <div className="w-20 h-20 bg-indigo-600 rounded-2xl flex items-center justify-center mb-8 shadow-2xl shadow-indigo-500/20">
          <i className="fas fa-robot text-white text-4xl"></i>
        </div>
        <h1 className={`text-3xl font-bold mb-4 ${isLight ? 'text-slate-900' : 'text-white'}`}>Gemini Pro Workspace</h1>
        <p className={`${subTextClass} max-w-md mb-8 leading-relaxed`}>
          To provide the best experience and avoid shared quota limits, please connect your own Google Cloud API key with a paid project.
        </p>
        <button 
          onClick={handleOpenKeyDialog}
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 px-8 rounded-xl transition-all duration-200 shadow-lg shadow-indigo-600/30 flex items-center space-x-3"
        >
          <i className="fas fa-key"></i>
          <span>Select API Key</span>
        </button>
        <a 
          href="https://ai.google.dev/gemini-api/docs/billing" 
          target="_blank" 
          rel="noopener noreferrer"
          className={`mt-6 ${subTextClass} hover:text-indigo-500 text-sm transition-colors flex items-center`}
        >
          Learn about billing and API keys <i className="fas fa-external-link-alt ml-2 text-xs"></i>
        </a>
      </div>
    );
  }

  return (
    <div className={`flex h-[100dvh] transition-colors duration-500 ${bgClass}`}>
      {/* Sidebar */}
      {showSidebar && (
        <aside className={`w-64 sm:w-72 border-r flex flex-col shrink-0 z-50 transition-colors duration-500 ${sidebarBgClass}`}>
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className={`font-bold text-sm uppercase tracking-widest ${textClass}`}>Conversations</h2>
            <button 
              onClick={createNewSession}
              className={`p-2 rounded-lg transition-colors ${buttonHoverClass} ${textClass}`}
              title="New Chat"
            >
              <i className="fas fa-plus"></i>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
            {sessions.map(session => (
              <div 
                key={session.id}
                onClick={() => setActiveSessionId(session.id)}
                className={`group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${
                  activeSessionId === session.id 
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
                    : `${textClass} ${buttonHoverClass}`
                }`}
              >
                <div className="flex items-center space-x-3 overflow-hidden">
                  <i className={`fas fa-comment-alt text-xs shrink-0 ${activeSessionId === session.id ? 'text-white' : 'text-indigo-500'}`}></i>
                  <span className="text-sm font-medium truncate">{session.title}</span>
                </div>
                <button 
                  onClick={(e) => deleteSession(e, session.id)}
                  className={`opacity-0 group-hover:opacity-100 p-1.5 rounded-md transition-all ${
                    activeSessionId === session.id ? 'hover:bg-indigo-500 text-white' : 'hover:bg-red-500/10 text-red-500'
                  }`}
                >
                  <i className="fas fa-times text-[10px]"></i>
                </button>
              </div>
            ))}
          </div>
          <div className="p-4 border-t">
            <div className={`text-[10px] uppercase tracking-widest font-bold mb-3 ${subTextClass}`}>Memory Cores</div>
            <div className="flex items-center space-x-2">
              <div className="flex space-x-1">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className={`w-1.5 h-4 rounded-full animate-pulse ${i % 2 === 0 ? 'bg-indigo-500' : 'bg-emerald-500'}`} style={{ animationDelay: `${i * 200}ms` }}></div>
                ))}
              </div>
              <span className={`text-[10px] font-mono ${subTextClass}`}>ACTIVE_SYNC_v3.1</span>
            </div>
          </div>
        </aside>
      )}

      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <header className={`flex items-center justify-between px-4 sm:px-6 py-3 border-b shrink-0 relative z-40 transition-colors duration-500 ${headerClass}`}>
          <div className="flex items-center space-x-3 overflow-hidden">
            <button 
              onClick={() => setShowSidebar(!showSidebar)}
              className={`p-2 rounded-lg transition-colors ${buttonHoverClass} ${subTextClass} mr-1`}
            >
              <i className={`fas ${showSidebar ? 'fa-indent' : 'fa-outdent'}`}></i>
            </button>
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-indigo-600 rounded-lg flex items-center justify-center shrink-0">
              <i className="fas fa-robot text-white text-lg sm:text-xl"></i>
            </div>
            <div className="min-w-0">
              <h1 className={`text-base sm:text-lg font-bold leading-tight truncate ${textClass}`}>{activeSession.title}</h1>
              <div className="flex items-center">
                <span className={`w-2 h-2 ${hasKey ? 'bg-green-500' : 'bg-yellow-500'} rounded-full mr-2 shrink-0`}></span>
                <span className={`text-xs ${subTextClass} truncate`}>{hasKey ? 'System Ready' : 'Key Needed'}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-4">
             {/* Display Settings Toggle */}
             <div className="relative">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className={`${subTextClass} hover:text-indigo-500 transition-colors p-2 rounded-lg ${buttonHoverClass}`}
                title="Display Settings"
              >
                <i className="fas fa-sliders-h"></i>
              </button>
              
              {showSettings && (
                <div className={`absolute right-0 top-full mt-2 w-64 border rounded-xl shadow-2xl p-4 space-y-4 ${settingsBgClass}`}>
                  <div>
                    <label className={`text-xs ${subTextClass} uppercase font-semibold tracking-wider mb-2 block`}>Density</label>
                    <div className={`flex p-1 rounded-lg border ${isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
                      <button 
                        onClick={() => setViewConfig(c => ({...c, density: 'comfortable'}))}
                        className={`flex-1 text-xs py-1.5 rounded-md transition-all ${viewConfig.density === 'comfortable' ? 'bg-indigo-600 text-white shadow-md' : `${subTextClass} hover:${textClass}`}`}
                      >
                        Comfortable
                      </button>
                      <button 
                        onClick={() => setViewConfig(c => ({...c, density: 'compact'}))}
                        className={`flex-1 text-xs py-1.5 rounded-md transition-all ${viewConfig.density === 'compact' ? 'bg-indigo-600 text-white shadow-md' : `${subTextClass} hover:${textClass}`}`}
                      >
                        Compact
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className={`text-xs ${subTextClass} uppercase font-semibold tracking-wider mb-2 block`}>Width</label>
                    <div className={`grid grid-cols-3 gap-1 p-1 rounded-lg border ${isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
                      <button 
                        onClick={() => setViewConfig(c => ({...c, width: 'standard'}))}
                        className={`text-xs py-1.5 rounded-md transition-all ${viewConfig.width === 'standard' ? 'bg-indigo-600 text-white shadow-md' : `${subTextClass} hover:${textClass}`}`}
                      >
                        Std
                      </button>
                      <button 
                        onClick={() => setViewConfig(c => ({...c, width: 'wide'}))}
                        className={`text-xs py-1.5 rounded-md transition-all ${viewConfig.width === 'wide' ? 'bg-indigo-600 text-white shadow-md' : `${subTextClass} hover:${textClass}`}`}
                      >
                        Wide
                      </button>
                      <button 
                        onClick={() => setViewConfig(c => ({...c, width: 'full'}))}
                        className={`text-xs py-1.5 rounded-md transition-all ${viewConfig.width === 'full' ? 'bg-indigo-600 text-white shadow-md' : `${subTextClass} hover:${textClass}`}`}
                      >
                        Full
                      </button>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Backdrop for settings */}
              {showSettings && (
                <div className="fixed inset-0 z-[-1]" onClick={() => setShowSettings(false)}></div>
              )}
             </div>

            <button 
              onClick={handleOpenKeyDialog}
              className={`${subTextClass} hover:text-indigo-500 transition-colors text-sm font-medium border ${isLight ? 'border-slate-300' : 'border-slate-700'} px-3 py-1.5 rounded-lg hover:border-indigo-500/50 hidden sm:block`}
            >
              <i className="fas fa-key mr-2"></i> Update API Key
            </button>
            <button 
              onClick={createNewSession}
              className={`${subTextClass} hover:${textClass} transition-colors text-sm font-medium p-2 sm:p-0`}
              title="New Chat"
            >
              <i className="fas fa-plus sm:mr-2"></i> <span className="hidden sm:inline">New Chat</span>
            </button>
          </div>
        </header>

        {/* Chat Area */}
        <main 
          ref={scrollRef}
          className={`flex-1 overflow-y-auto custom-scrollbar p-2 sm:p-4 md:p-8 space-y-4 sm:space-y-6 ${viewConfig.density === 'compact' ? 'text-sm' : ''}`}
          onClick={() => setShowSettings(false)}
        >
          <div className={`${getContainerMaxWidth()} mx-auto space-y-4 sm:space-y-8 transition-all duration-300`}>
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} density={viewConfig.density} mood={mood} />
            ))}
          </div>
        </main>

        {/* Input Area */}
        <div className={`p-2 sm:p-4 md:p-6 border-t shrink-0 transition-colors duration-500 ${inputContainerClass}`}>
          <div className={`${getContainerMaxWidth()} mx-auto transition-all duration-300`}>
            <ChatInput onSend={handleSendMessage} disabled={isTyping} density={viewConfig.density} mood={mood} />
            <p className={`text-center text-[10px] sm:text-xs mt-3 sm:mt-4 px-2 ${subTextClass}`}>
              Gemini may display inaccurate info, including about people, so double-check its responses.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
