import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const globalForChat = globalThis as unknown as {
  chatMessages: {
    id: string;
    author: string;
    text: string;
    timestamp: number;
  }[];
};

if (!globalForChat.chatMessages) {
  globalForChat.chatMessages = [];
}

const chatMessages = globalForChat.chatMessages;

export async function GET() {
  // Keep only the last 50 messages to prevent memory leak
  if (chatMessages.length > 50) {
    chatMessages.splice(0, chatMessages.length - 50);
  }
  return NextResponse.json(chatMessages);
}

const PostSchema = z.object({
  author: z.string().min(1).max(30),
  text: z.string().min(1).max(500),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = PostSchema.parse(body);

    const newMessage = {
      id: Math.random().toString(36).slice(2, 9),
      author: parsed.author,
      text: parsed.text,
      timestamp: Date.now(),
    };

    chatMessages.push(newMessage);

    return NextResponse.json(newMessage);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
