"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import useSWR from "swr";
import { Rnd } from "react-rnd";

interface ChatMessage {
  id: string;
  author: string;
  text: string;
  timestamp: number;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

// ─── Shared message list ───────────────────────────────────────────────────────
function MessageList({
  messages,
  messagesEndRef,
}: {
  messages: ChatMessage[] | undefined;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
      {!messages || messages.length === 0 ? (
        <div className="text-center text-neutral-500 text-sm mt-4">
          No messages yet. Say hi!
        </div>
      ) : (
        messages.map((msg) => (
          <div key={msg.id} className="flex flex-col">
            <div className="flex items-baseline gap-2 mb-0.5">
              <span
                className="font-semibold text-cyan-400 text-sm"
                style={{ fontFamily: "var(--font-sans)" }}
              >
                {msg.author}
              </span>
              <span className="text-[10px] text-neutral-500">
                {new Date(msg.timestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <div className="text-neutral-200 text-sm leading-relaxed">
              {msg.text}
            </div>
          </div>
        ))
      )}
      <div ref={messagesEndRef} />
    </div>
  );
}

// ─── Shared send input ─────────────────────────────────────────────────────────
function SendInput({
  text,
  setText,
  onSubmit,
}: {
  text: string;
  setText: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <div className="p-3 border-t border-white/10 bg-black/20 flex-shrink-0">
      <form onSubmit={onSubmit} className="flex gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message..."
          maxLength={500}
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-500/50 transition-colors"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-neutral-700 disabled:text-neutral-500 rounded-lg text-white font-semibold text-sm transition-colors"
        >
          Send
        </button>
      </form>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function GlobalChat() {
  const DESKTOP_W = 320;
  const DESKTOP_H = 420;

  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const [size, setSize] = useState({ width: DESKTOP_W, height: DESKTOP_H });
  const [position, setPosition] = useState({ x: 24, y: 0 });

  const [author, setAuthor] = useState("Explorer");
  const [text, setText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const { data: messages, mutate } = useSWR<ChatMessage[]>("/api/chat", fetcher, {
    refreshInterval: 3000,
  });

  useEffect(() => {
    setMounted(true);
    setAuthor(`Explorer${Math.floor(Math.random() * 10000)}`);

    const updateLayout = () => {
      const mobile = window.innerWidth < 640;
      setIsMobile(mobile);
      // Initial Y position for desktop panel
      if (!mobile) {
        setPosition((p) => ({ ...p, y: window.innerHeight - DESKTOP_H - 24 }));
      }
    };

    updateLayout();
    window.addEventListener("resize", updateLayout);
    return () => window.removeEventListener("resize", updateLayout);
  }, []);

  useEffect(() => {
    if (messagesEndRef.current && !isMinimized && isOpen) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isMinimized, isOpen]);

  const handleSend = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!text.trim()) return;

      const newMsg = { author, text: text.trim() };
      setText("");

      // Optimistic update
      mutate(
        (prev) => [...(prev ?? []), { ...newMsg, id: "temp", timestamp: Date.now() }],
        false,
      );

      await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newMsg),
      });

      mutate();
    },
    [author, text, mutate],
  );

  const handleToggleMinimize = useCallback(() => {
    setIsMinimized((prev) => {
      const willMinimize = !prev;
      if (!isMobile) {
        const heightDiff = size.height - 48;
        setPosition((p) => {
          let newY = willMinimize ? p.y + heightDiff : p.y - heightDiff;
          newY = Math.max(0, newY);
          if (typeof window !== "undefined") {
            const maxY = window.innerHeight - (willMinimize ? 48 : size.height);
            newY = Math.min(newY, maxY);
          }
          return { ...p, y: newY };
        });
      }
      return willMinimize;
    });
  }, [isMobile, size.height]);

  if (!mounted) return null;

  // ── Closed: floating FAB button ──────────────────────────────────────────────
  if (!isOpen) {
    return (
      <button
        id="global-chat-open-btn"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 left-6 z-50 flex items-center gap-2 px-4 py-3 rounded-full bg-cyan-600/90 hover:bg-cyan-500/90 border border-cyan-400/50 text-white shadow-xl shadow-cyan-900/20 transition-all font-semibold"
        style={{ fontFamily: "var(--font-sans)" }}
      >
        <span>💬</span>
        <span className="hidden sm:inline">Global Chat</span>
      </button>
    );
  }

  // ── Mobile: full-width bottom sheet ─────────────────────────────────────────
  if (isMobile) {
    return (
      <div
        id="global-chat-mobile"
        className="fixed left-0 right-0 bottom-0 z-[200] flex flex-col bg-[var(--color-surface-900)] border-t border-white/10 shadow-2xl transition-all duration-300"
        style={{ height: isMinimized ? "52px" : "55vh", overflow: "hidden" }}
      >
        {/* Header — tap to toggle minimize */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/5 flex-shrink-0 cursor-pointer"
          onClick={handleToggleMinimize}
        >
          <div
            className="flex items-center gap-2 font-bold text-neutral-100"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            <span>💬</span>
            Global Explorer Chat
          </div>
          <div className="flex items-center gap-2">
            <span className="text-neutral-400 text-sm">{isMinimized ? "▲" : "▼"}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(false);
              }}
              className="w-8 h-8 flex items-center justify-center text-neutral-400 hover:text-red-400 transition-colors"
              aria-label="Close chat"
            >
              ✕
            </button>
          </div>
        </div>

        {!isMinimized && (
          <>
            <MessageList messages={messages} messagesEndRef={messagesEndRef} />
            <SendInput text={text} setText={setText} onSubmit={handleSend} />
          </>
        )}
      </div>
    );
  }

  // ── Desktop: draggable resizable floating panel ──────────────────────────────
  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      <Rnd
        position={position}
        size={{ width: size.width, height: isMinimized ? 48 : size.height }}
        onDrag={(_e, d) => setPosition({ x: d.x, y: d.y })}
        onDragStop={(_e, d) => setPosition({ x: d.x, y: d.y })}
        onResize={(_e, _dir, ref, _delta, pos) => {
          setSize({
            width: parseInt(ref.style.width, 10),
            height: parseInt(ref.style.height, 10),
          });
          setPosition(pos);
        }}
        onResizeStop={(_e, _dir, ref, _delta, pos) => {
          setSize({
            width: parseInt(ref.style.width, 10),
            height: parseInt(ref.style.height, 10),
          });
          setPosition(pos);
        }}
        minWidth={280}
        minHeight={isMinimized ? 48 : 300}
        bounds="window"
        dragHandleClassName="chat-drag-handle"
        enableResizing={!isMinimized}
        style={{ pointerEvents: "auto", position: "absolute" }}
      >
        <div className="flex flex-col w-full h-full bg-[var(--color-surface-900)] rounded-xl border border-white/10 shadow-2xl overflow-hidden glass-card">
          {/* Header */}
          <div className="chat-drag-handle flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/5 cursor-move select-none flex-shrink-0">
            <div
              className="flex items-center gap-2 font-bold text-neutral-100"
              style={{ fontFamily: "var(--font-sans)" }}
            >
              <span>💬</span>
              Global Explorer Chat
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleToggleMinimize}
                className="w-6 h-6 flex items-center justify-center text-neutral-400 hover:text-white transition-colors"
                aria-label={isMinimized ? "Expand" : "Minimize"}
              >
                {isMinimized ? "▲" : "▼"}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="w-6 h-6 flex items-center justify-center text-neutral-400 hover:text-red-400 transition-colors"
                aria-label="Close chat"
              >
                ✕
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              <MessageList messages={messages} messagesEndRef={messagesEndRef} />
              <SendInput text={text} setText={setText} onSubmit={handleSend} />
            </>
          )}
        </div>
      </Rnd>
    </div>
  );
}
