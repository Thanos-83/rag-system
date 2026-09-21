'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { BrainIcon, UserIcon } from 'lucide-react';

type Citation = {
  title: string;
  distance: number;
  document: string;
};

type Message = {
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
};

const TOP_CATEGORIES = [
  'All',
  'Machine Learning',
  'Computer Vision and Pattern Recognition',
  'Computation and Language (Natural Language Processing)',
  'Artificial Intelligence',
  'Machine Learning (Statistics)',
  'Neural and Evolutionary Computing',
  'Robotics',
  'Cryptography and Security',
  'Image and Video Processing',
  'Information Retrieval',
];

export default function ChatPage() {
  // Chat States
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // New RAG Evaluation States
  const [category, setCategory] = useState<string>('All');
  const [nResults, setNResults] = useState<number>(3);
  const [promptType, setPromptType] = useState<string>('hybrid');
  const [temperature, setTemperature] = useState<number>(0.0);
  const [topK, setTopK] = useState<number>(40);
  const [numPredict, setNumPredict] = useState<number>(500);
  const [repeatPenalty, setRepeatPenalty] = useState<number>(1.1);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Inject all the new evaluation parameters into the API request
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/chat`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: userMessage.content,
            category: category,
            n_results: nResults,
            prompt_type: promptType,
            temperature: temperature,
            top_k: topK,
            num_predict: numPredict,
            repeat_penalty: repeatPenalty,
          }),
        },
      );

      if (!response.ok) throw new Error('Network error');

      const data = await response.json();

      const aiMessage: Message = {
        role: 'assistant',
        content: data.answer,
        citations: data.citations,
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error:', error);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Error connecting to server.' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className='min-h-screen bg-zinc-50 p-4 md:p-8'>
      <div className='max-w-7xl mx-auto'>
        <header className='mb-8'>
          <h1 className='text-3xl font-bold tracking-tight'>
            RAG System Playground
          </h1>
          <p className='text-zinc-500 mt-1'>
            Adjust vector retrieval and LLM generation parameters in real-time.
          </p>
        </header>

        <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
          {/* ============================== */}
          {/* LEFT COLUMN: SETTINGS DASHBOARD */}
          {/* ============================== */}
          <div className='lg:col-span-1 space-y-6'>
            {/* 1. Retrieval Settings */}
            <Card>
              <CardHeader className='pb-3 border-b mb-4'>
                <CardTitle className='text-lg'>Retrieval Settings</CardTitle>
              </CardHeader>
              <CardContent className='space-y-6'>
                {/* Category Dropdown */}
                <div className='space-y-2'>
                  <label className='text-sm font-medium'>Domain Filter</label>
                  <Select
                    value={category}
                    onValueChange={(value) => setCategory(value || 'All')}>
                    <SelectTrigger className='w-full'>
                      <SelectValue placeholder='Select Category' />
                    </SelectTrigger>
                    <SelectContent>
                      {TOP_CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* n_results Slider */}
                <div>
                  <div className='flex justify-between text-sm mb-2'>
                    <label className='font-medium'>
                      Context Window (n_results)
                    </label>
                    <span className='text-zinc-500 font-mono'>{nResults}</span>
                  </div>
                  <input
                    type='range'
                    min='1'
                    max='10'
                    step='1'
                    value={nResults}
                    onChange={(e) => setNResults(parseInt(e.target.value))}
                    className='w-full accent-zinc-800'
                  />
                  <p className='text-xs text-zinc-400 mt-1'>
                    Number of abstracts retrieved from ChromaDB.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* 2. Generation Settings */}
            <Card>
              <CardHeader className='pb-3 border-b mb-4'>
                <CardTitle className='text-lg'>Generation Settings</CardTitle>
              </CardHeader>
              <CardContent className='space-y-6'>
                {/* Prompt Type Dropdown */}
                <div className='space-y-2'>
                  <label className='text-sm font-medium'>
                    System Prompt Behavior
                  </label>
                  <Select
                    value={promptType}
                    onValueChange={(value) => setPromptType(value)}>
                    <SelectTrigger className='w-full'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='hybrid'>
                        Hybrid (Allows parametric knowledge)
                      </SelectItem>
                      <SelectItem value='strict'>
                        Strict (Pure RAG context only)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Temperature Slider */}
                <div>
                  <div className='flex justify-between text-sm mb-2'>
                    <label className='font-medium'>Temperature</label>
                    <span className='text-zinc-500 font-mono'>
                      {temperature.toFixed(1)}
                    </span>
                  </div>
                  <input
                    type='range'
                    min='0'
                    max='1'
                    step='0.1'
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                    className='w-full accent-zinc-800'
                  />
                </div>

                {/* Top-K Slider */}
                <div>
                  <div className='flex justify-between text-sm mb-2'>
                    <label className='font-medium'>Top-K Sampling</label>
                    <span className='text-zinc-500 font-mono'>{topK}</span>
                  </div>
                  <input
                    type='range'
                    min='1'
                    max='100'
                    step='1'
                    value={topK}
                    onChange={(e) => setTopK(parseInt(e.target.value))}
                    className='w-full accent-zinc-800'
                  />
                </div>

                {/* Repeat Penalty Slider */}
                <div>
                  <div className='flex justify-between text-sm mb-2'>
                    <label className='font-medium'>Repetition Penalty</label>
                    <span className='text-zinc-500 font-mono'>
                      {repeatPenalty.toFixed(1)}
                    </span>
                  </div>
                  <input
                    type='range'
                    min='1.0'
                    max='2.0'
                    step='0.1'
                    value={repeatPenalty}
                    onChange={(e) =>
                      setRepeatPenalty(parseFloat(e.target.value))
                    }
                    className='w-full accent-zinc-800'
                  />
                </div>

                {/* Num Predict (Max Tokens) Slider */}
                <div>
                  <div className='flex justify-between text-sm mb-2'>
                    <label className='font-medium'>
                      Max Tokens (num_predict)
                    </label>
                    <span className='text-zinc-500 font-mono'>
                      {numPredict}
                    </span>
                  </div>
                  <input
                    type='range'
                    min='100'
                    max='2000'
                    step='50'
                    value={numPredict}
                    onChange={(e) => setNumPredict(parseInt(e.target.value))}
                    className='w-full accent-zinc-800'
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ============================== */}
          {/* RIGHT COLUMN: CHAT INTERFACE   */}
          {/* ============================== */}
          <div className='lg:col-span-2'>
            <Card className='w-full h-[80vh] flex flex-col shadow-lg'>
              <CardContent className='flex-1 overflow-hidden p-0'>
                <ScrollArea className='h-full p-6'>
                  <div className='flex flex-col gap-6'>
                    {messages.length === 0 && (
                      <div className='text-center text-zinc-500 mt-20'>
                        Ask a question to test the current parameters.
                      </div>
                    )}

                    {messages.map((msg, index) => (
                      <div
                        key={index}
                        className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {msg.role === 'assistant' && (
                          <Avatar className='flex items-center justify-center'>
                            <BrainIcon className='w-4 h-4 text-zinc-600' />
                          </Avatar>
                        )}

                        <div
                          className={`max-w-[85%] rounded-xl p-5 ${msg.role === 'user' ? 'bg-[#F2F0F0] text-black' : 'bg-white border shadow-sm'}`}>
                          {msg.role === 'user' ? (
                            <p>{msg.content}</p>
                          ) : (
                            <div className='w-full'>
                              <div className='text-sm leading-relaxed'>
                                <ReactMarkdown
                                  remarkPlugins={[remarkGfm, remarkMath]}
                                  rehypePlugins={[
                                    [
                                      rehypeKatex,
                                      { strict: false, throwOnError: false },
                                    ],
                                  ]}>
                                  {preprocessLaTeX(msg.content)}
                                </ReactMarkdown>
                              </div>

                              {/* Citations block */}
                              {msg.citations && msg.citations.length > 0 && (
                                <div className='mt-6 pt-4 border-t text-xs text-zinc-500'>
                                  <strong className='block mb-2'>
                                    Retrieved Top{' '}
                                    <span className='font-bold'>
                                      {msg.citations.length}
                                    </span>{' '}
                                    Sources (Based on L2 Distance criteria):
                                  </strong>
                                  <Accordion
                                    type='single'
                                    collapsible
                                    defaultValue={msg.citations[0].title}>
                                    {msg.citations.map((citation, index) => (
                                      <AccordionItem
                                        key={index}
                                        value={citation.title}>
                                        <AccordionTrigger className='border rounded-lg py-2 mb-2 px-3'>
                                          <div className='flex-1 mr-6 font-medium flex items-center justify-between'>
                                            <p className='text-left'>
                                              {citation.title}
                                            </p>
                                            <span className='ml-2 text-xs bg-zinc-100 py-1 px-2 rounded-full text-zinc-600 whitespace-nowrap'>
                                              Dist: {citation.distance}
                                            </span>
                                          </div>
                                        </AccordionTrigger>
                                        <AccordionContent className='px-3'>
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
                          <Avatar className='flex items-center justify-center'>
                            <UserIcon className='w-4 h-4 text-zinc-600' />
                          </Avatar>
                        )}
                      </div>
                    ))}
                    {isLoading && (
                      <div className='flex gap-4 justify-start'>
                        <Avatar>
                          <AvatarFallback>AI</AvatarFallback>
                        </Avatar>
                        <div className='bg-white border shadow-sm rounded-xl p-4 text-zinc-500 text-sm animate-pulse'>
                          Evaluating prompt against ChromaDB and generating
                          response...
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>

              <CardFooter className='p-4 border-t bg-white'>
                <form onSubmit={sendMessage} className='flex w-full gap-3'>
                  <Input
                    placeholder="Test the model's response..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    disabled={isLoading}
                    className='flex-1'
                  />
                  <Button type='submit' disabled={isLoading || !input.trim()}>
                    Send
                  </Button>
                </form>
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}

// This helper function cleans up the Markdown Text from the LLM model to eliminate formatting errors for LaTeX
const preprocessLaTeX = (content: string) => {
  if (!content) return '';
  return (
    content
      // 1. Catch standard LaTeX block delimiters \[...\]
      .replace(/\\\[([\s\S]*?)\\\]/g, (_match, p1) => `$$${p1}$$`)
      // 2. Catch standard LaTeX inline delimiters \(...\)
      .replace(/\\\(([\s\S]*?)\\\)/g, (_match, p1) => `$${p1}$`)

      // 3. Strip out \tag{...} completely (it breaks Markdown parsing when placed outside math)
      .replace(/\\tag{[^}]*}/g, '')

      // 4. THE FIX: Catch \begin...\end blocks AND absorb any single or double $ around them
      // This stops the $ $$...$$ $ conflict from happening     .replace(/\$*\s*(\\begin{[a-zA-Z*]+}[\s\S]*?\\end{[a-zA-Z*]+})\s*\$*/g, "\n$$\n$1\n$$\n")

      // 5. Catch the bracket error: [ \begin{aligned} ... \end{aligned} ]
      .replace(
        /\[\s*(\\begin{[\s\S]*?}[\s\S]*?\\end{[\s\S]*?})\s*\]/g,
        '\n$$\n$1\n$$\n',
      ) // 6. Fix \bm{} to \boldsymbol{} (KaTeX compatibility)     .replace(/\\bm{/g, "\\boldsymbol{")     // 7. Fix escaped underscores     .replace(/\\_/g, "_")     // 8. Remove the \! negative space command     .replace(/\\!/g, "")     // 9. Remove the \boxed command but leave its contents safe     .replace(/\\boxed/g, "")          // 10. Clean up any accidental double-wrapping of $$
      .replace(/\$\$\s*\$\$/g, '$$') // 11. Ensure block math $$ has safe line breaks around it
      .replace(
        /\$\$([\s\S]*?)\$\$/g,
        (_match, p1) => `\n$$\n${p1.trim()}\n$$\n`,
      )
  );
};
