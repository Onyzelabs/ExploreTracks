"use client";

import { useState, useRef, useEffect } from "react";
import useSWR from "swr";
import { Rnd } from "react-rnd";

interface ChatMessage {
  id: string;
  author: string;
  text: string;
  timestamp: number;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function GlobalChat() {
  const initialWidth = 320;
  const initialHeight = 450;
  const initialX = 24; // 24px from left

  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  const initialY =
    typeof window !== "undefined" ? window.innerHeight - initialHeight - 24 : 0;

  const [size, setSize] = useState({
    width: initialWidth,
    height: initialHeight,
  });
  const [position, setPosition] = useState({ x: initialX, y: initialY });
  const [author, setAuthor] = useState("Explorer");
  const [text, setText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: messages, mutate } = useSWR<ChatMessage[]>(
    "/api/chat",
    fetcher,
    {
      refreshInterval: 1000,
    },
  );

  useEffect(() => {
    setMounted(true);
    // Generate random author name once
    setAuthor(`Explorer${Math.floor(Math.random() * 10000)}`);
  }, []);

  useEffect(() => {
    if (messagesEndRef.current && !isMinimized && isOpen) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isMinimized, isOpen]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    const newMsg = { author, text: text.trim() };
    setText("");

    // Optimistic UI update
    mutate(
      (prev) => [
        ...(prev || []),
        { ...newMsg, id: "temp", timestamp: Date.now() },
      ],
      false,
    );

    await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newMsg),
    });

    mutate();
  };

  if (!mounted) return null;

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 left-6 z-50 flex items-center gap-2 px-4 py-3 rounded-full bg-cyan-600/90 hover:bg-cyan-500/90 border border-cyan-400/50 text-white shadow-xl shadow-cyan-900/20 transition-all font-semibold"
        style={{ fontFamily: "var(--font-sans)" }}
      >
        <span>💬</span>
        Global Chat
      </button>
    );
  }

  const handleToggleMinimize = () => {
    setIsMinimized((prev) => {
      const willBeMinimized = !prev;
      const heightDiff = size.height - 48;

      setPosition((currPos) => {
        let newY = willBeMinimized
          ? currPos.y + heightDiff
          : currPos.y - heightDiff;
        // Prevent jumping off the top of the screen when unfolding
        if (newY < 0) newY = 0;
        // Prevent jumping off the bottom
        if (typeof window !== "undefined") {
          const maxY =
            window.innerHeight - (willBeMinimized ? 48 : size.height);
          if (newY > maxY) newY = maxY;
        }
        return {
          x: currPos.x,
          y: newY,
        };
      });

      return willBeMinimized;
    });
  };

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      <Rnd
        position={position}
        size={{
          width: size.width,
          height: isMinimized ? 48 : size.height,
        }}
        onDrag={(e, d) => setPosition({ x: d.x, y: d.y })}
        onDragStop={(e, d) => setPosition({ x: d.x, y: d.y })}
        onResize={(e, direction, ref, delta, pos) => {
          setSize({
            width: parseInt(ref.style.width, 10),
            height: parseInt(ref.style.height, 10),
          });
          setPosition(pos);
        }}
        onResizeStop={(e, direction, ref, delta, pos) => {
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
        disableDragging={false}
        enableResizing={!isMinimized}
        style={{ pointerEvents: "auto", position: "absolute" }}
      >
        <div className="flex flex-col w-full h-full bg-[var(--color-surface-900)] rounded-xl border border-white/10 shadow-2xl overflow-hidden glass-card">
          {/* Header */}
          <div className="chat-drag-handle flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/5 cursor-move select-none">
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
              >
                {isMinimized ? "▲" : "▼"}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="w-6 h-6 flex items-center justify-center text-neutral-400 hover:text-red-400 transition-colors"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Messages Area */}
          {!isMinimized && (
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
              {messages?.length === 0 ? (
                <div className="text-center text-neutral-500 text-sm mt-4">
                  No messages yet. Say hi!
                </div>
              ) : (
                messages?.map((msg) => (
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
          )}

          {/* Input Area */}
          {!isMinimized && (
            <div className="p-3 border-t border-white/10 bg-black/20">
              <form onSubmit={handleSend} className="flex gap-2">
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
          )}
        </div>
      </Rnd>
    </div>
  );
}
