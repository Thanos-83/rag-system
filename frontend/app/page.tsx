"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css"; // Required to render math equations correctly

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

// Define the shape of a single chat message
type Message = {
  role: "user" | "assistant";
  content: string;
  sources?: string[];
};

// This converts standard LLM math delimiters into standard Markdown math delimiters
const preprocessLaTeX = (content: string) => {
  if (!content) return "";
  return content
    .replace(/\\\[([\s\S]*?)\\\]/g, (match, p1) => `$$${p1}$$`)
    .replace(/\\\(([\s\S]*?)\\\)/g, (match, p1) => `$${p1}$`);
};

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    // Add the user's message to the chat
    const userMessage: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // Send the query to your Python FastAPI backend
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: userMessage.content }),
      });

      if (!response.ok) throw new Error("Network response was not ok");

      const data = await response.json();
      
      // Add the AI's response and citations to the chat
      const aiMessage: Message = { 
        role: "assistant", 
        content: data.answer,
        sources: data.sources
      };
      
      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error("Error fetching response:", error);
      setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, there was an error connecting to the server." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center p-4 bg-zinc-50">
      <Card className="w-full max-w-4xl h-[85vh] flex flex-col shadow-lg">
        <CardHeader className="border-b">
          <CardTitle>Academic Research Assistant</CardTitle>
        </CardHeader>
        
        <CardContent className="flex-1 overflow-hidden p-0">
          <ScrollArea className="h-full p-6">
            <div className="flex flex-col gap-6">
              {messages.length === 0 && (
                <div className="text-center text-zinc-500 mt-20">
                  Ask a question about deep learning theory to search the Chroma database.
                </div>
              )}

              {messages.map((msg, index) => (
                <div key={index} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                    <Avatar><AvatarFallback>AI</AvatarFallback></Avatar>
                  )}
                  
                  <div className={`max-w-[95%] rounded-md p-5 ${msg.role === 'user' ? 'bg-zinc-900 text-white' : 'bg-white border border-gray-200/50 shadow-sm'}`}>
                    {msg.role === 'user' ? (
                      <p>{msg.content}</p>
                    ) : (
                      <div className="w-full">
                          
                        <div className="text-sm leading-relaxed">
                        {/* Render Markdown and Math safely */}
                        <ReactMarkdown 
                          remarkPlugins={[remarkGfm, remarkMath]} 
                          rehypePlugins={[rehypeKatex]}
                          components={{
                            h1: ({node, ...props}) => <h1 className="text-2xl font-bold mt-4 mb-2" {...props} />,
                            h2: ({node, ...props}) => <h2 className="text-xl font-bold mt-4 mb-2" {...props} />,
                            h3: ({node, ...props}) => <h3 className="text-lg font-bold mt-4 mb-2" {...props} />,
                            ul: ({node, ...props}) => <ul className="list-disc pl-6 mb-4" {...props} />,
                            ol: ({node, ...props}) => <ol className="list-decimal pl-6 mb-4" {...props} />,
                            p: ({node, ...props}) => <p className="mb-4 last:mb-0" {...props} />,
                            table: ({node, ...props}) => <div className="overflow-x-auto mb-4"><table className="min-w-full border" {...props} /></div>,
                            th: ({node, ...props}) => <th className="border px-4 py-2 bg-zinc-50" {...props} />,
                            td: ({node, ...props}) => <td className="border px-4 py-2" {...props} />
                          }}
                        >
                          {preprocessLaTeX(msg.content)}
                        </ReactMarkdown>
                        </div>
                        
                        {/* Render Citations if they exist */}
                        {msg.sources && msg.sources.length > 0 && (
                          <div className="mt-6 pt-4 border-t text-xs text-zinc-500">
                            <strong className="block mb-2">Retrieved Sources:</strong>
                            <ul className="list-disc pl-4 space-y-1">
                              {msg.sources.map((source, i) => (
                                <li key={i}>{source}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {msg.role === 'user' && (
                    <Avatar><AvatarFallback>U</AvatarFallback></Avatar>
                  )}
                </div>
              ))}

              {/* Loading indicator */}
              {isLoading && (
                <div className="flex gap-4 justify-start">
                   <Avatar><AvatarFallback>AI</AvatarFallback></Avatar>
                   <div className="bg-white border shadow-sm rounded-xl p-4 text-zinc-500 text-sm animate-pulse">
                      Searching academic papers and generating response...
                   </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>

        <CardFooter className="p-4 border-t bg-white">
          <form onSubmit={sendMessage} className="flex w-full gap-3">
            <Input 
              placeholder="Ask about backpropagation or transformers..." 
              value={input} 
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading}
              className="flex-1"
            />
            <Button type="submit" disabled={isLoading || !input.trim()}>
              Send
            </Button>
          </form>
        </CardFooter>
      </Card>
    </main>
  );
}