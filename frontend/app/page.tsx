"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

// 1. Update the Message type to expect our new citations array
type Citation = {
  title: string;
  distance: number;
  document: string;
};

type Message = {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
};

// Replace these with the actual top 10 categories from your dataset
const TOP_CATEGORIES = [
"All",
"Machine Learning",
"Computer Vision and Pattern Recognition",
"Computation and Language (Natural Language Processing)",
"Artificial Intelligence",
"Machine Learning (Statistics)",
"Neural and Evolutionary Computing",
"Robotics",
"Cryptography and Security",
"Image and Video Processing",
"Information Retrieval"
];



export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [category, setCategory] = useState<string>("All"); 
  const [isLoading, setIsLoading] = useState(false);


  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // 3. Send the selected category in the payload
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: userMessage.content, category: category }),
      });

      if (!response.ok) throw new Error("Network error");

      const data = await response.json();
      
      console.log('Received data from backend: ', data);
      const aiMessage: Message = { 
        role: "assistant", 
        content: data.answer,
        citations: data.citations
      };

      console.log('Response data: ', data)
      
      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error("Error:", error);
      setMessages((prev) => [...prev, { role: "assistant", content: "Error connecting to server." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex flex-col min-h-screen items-center justify-center p-4 bg-zinc-50">
      <h1 className="text-2xl font-bold mb-6">Academic Research Assistant Bot</h1>
      <Card className="w-full max-w-4xl h-[85vh] flex flex-col shadow-lg">
        <CardHeader className="border-b flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg">Select Specific Category (Optional)</CardTitle>
          
          {/* 5. The Category Dropdown */}
          <div className="w-full max-w-[380px]">
            <Select  value={category} onValueChange={(value)=> setCategory(value || 'All')}>
              <SelectTrigger className='w-full'>
                <SelectValue placeholder="Select Category" />
              </SelectTrigger>
              <SelectContent>
                {TOP_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        
        <CardContent className="flex-1 overflow-hidden p-0">
          <ScrollArea className="h-full p-6">
            <div className="flex flex-col gap-6">
              {messages.length === 0 && (
                <div className="text-center text-zinc-500 mt-20">
                  Ask a question to search the Chroma database.
                </div>
              )}

              {messages.map((msg, index) => (
                <div key={index} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                    <Avatar><AvatarFallback>AI</AvatarFallback></Avatar>
                  )}
                  
                  <div className={`max-w-[85%] rounded-xl p-5 ${msg.role === 'user' ? 'bg-[#F2F0F0] text-black' : 'bg-white border shadow-sm'}`}>
                    {msg.role === 'user' ? (
                      <p>{msg.content}</p>
                    ) : (
                      <div className="w-full">
                        <div className="text-sm leading-relaxed">
                          <ReactMarkdown 
                            remarkPlugins={[remarkGfm, remarkMath]} 
                            rehypePlugins={[[rehypeKatex, { strict: false, throwOnError: false }]]}
                          >
                            {preprocessLaTeX(msg.content)} 
                          </ReactMarkdown>
                        </div>
 
                        {/* 6. Render Citations with Distance */}
                        {msg.citations && msg.citations.length > 0 && (
                          <div className="mt-6 pt-4 border-t text-xs text-zinc-500">
                            <strong className="block mb-2">Retrieved Top <span className="font-bold">{msg.citations.length}</span> Sources (Based on L2 Distance criteria):</strong>
                        
                            <Accordion defaultValue={[`${msg.citations[0].title}`]} >
                              {msg.citations.map((citation, index) => (
                              <AccordionItem key={index} value={`${citation.title}`}>
                                <AccordionTrigger className="border rounded-lg py-2 mb-2">
                                  <div className="flex-1 mr-6 font-medium flex items-center justify-between">
                                    <p>{citation.title}</p>
                                    <span className="ml-2 text-xs bg-zinc-100 py-1 px-2 text-zinc-600">Distance: {citation.distance}</span>
                                  </div>
                                </AccordionTrigger>
                                <AccordionContent>
                                  <p>{citation.document}</p>
                                </AccordionContent> 
                              </AccordionItem>
                              ))}
                            </Accordion>
                        
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



// This helper function cleans up the Markdown Text from the LLM model to eliminate formatting errors for LaTeX
const preprocessLaTeX = (content: string) => {
  if (!content) return "";
  return content
    // 1. Catch standard LaTeX block delimiters \[ ... \]
    .replace(/\\\[([\s\S]*?)\\\]/g, (_match, p1) => `$$${p1}$$`)
    // 2. Catch standard LaTeX inline delimiters \( ... \)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_match, p1) => `$${p1}$`)
    
    // 3. Strip out \tag{...} completely (it breaks Markdown parsing when placed outside math)
    .replace(/\\tag{[^}]*}/g, "")
    
    // 4. THE FIX: Catch \begin...\end blocks AND absorb any single or double $ around them
    // This stops the $ $$ ... $$ $ conflict from happening
    .replace(/\$*\s*(\\begin{[a-zA-Z*]+}[\s\S]*?\\end{[a-zA-Z*]+})\s*\$*/g, "\n$$\n$1\n$$\n")
    
    // 5. Catch the bracket error: [ \begin{aligned} ... \end{aligned} ]
    .replace(/\[\s*(\\begin{[\s\S]*?}[\s\S]*?\\end{[\s\S]*?})\s*\]/g, "\n$$\n$1\n$$\n")
    
    // 6. Fix \bm{} to \boldsymbol{} (KaTeX compatibility)
    .replace(/\\bm{/g, "\\boldsymbol{")
    // 7. Fix escaped underscores
    .replace(/\\_/g, "_")
    // 8. Remove the \! negative space command
    .replace(/\\!/g, "")
    // 9. Remove the \boxed command but leave its contents safe
    .replace(/\\boxed/g, "")
    
    // 10. Clean up any accidental double-wrapping of $$ 
    .replace(/\$\$\s*\$\$/g, "$$")
    // 11. Ensure block math $$ has safe line breaks around it
    .replace(/\$\$([\s\S]*?)\$\$/g, (_match, p1) => `\n$$\n${p1.trim()}\n$$\n`);
};

