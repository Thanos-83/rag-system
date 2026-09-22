// @ts-nocheck

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
import { Avatar } from '@/components/ui/avatar';
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

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { BrainIcon, UserIcon, BarChart3Icon, HelpCircle } from 'lucide-react';

type Citation = {
  title: string | null;
  distance: number;
  document: string;
};

type Message = {
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
};

type EvaluationScores = {
  faithfulness: number | null;
  answer_relevancy: number | null;
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
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [category, setCategory] = useState<string>('All');
  const [nResults, setNResults] = useState<number>(3);
  const [promptType, setPromptType] = useState<string>('hybrid');
  const [temperature, setTemperature] = useState<number>(0.0);
  const [topK, setTopK] = useState<number>(40);
  const [numPredict, setNumPredict] = useState<number>(1000);
  const [repeatPenalty, setRepeatPenalty] = useState<number>(1.1);

  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evalScores, setEvalScores] = useState<EvaluationScores>({
    faithfulness: null,
    answer_relevancy: null,
  });

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setEvalScores({ faithfulness: null, answer_relevancy: null });

    try {
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

  const handleEvaluate = async () => {
    const lastAiIndex = messages.map((m) => m.role).lastIndexOf('assistant');
    if (lastAiIndex === -1) return;

    const aiMessage = messages[lastAiIndex];
    const userMessage = messages[lastAiIndex - 1];

    if (!aiMessage || !userMessage) return;

    const contexts = aiMessage.citations?.map((c) => c.document) || [];

    setIsEvaluating(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/evaluate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_input: userMessage.content,
            retrieved_contexts: contexts,
            response: aiMessage.content,
          }),
        },
      );

      if (!response.ok) throw new Error('Evaluation API failed');

      const data = await response.json();
      setEvalScores({
        faithfulness: data.faithfulness,
        answer_relevancy: data.answer_relevancy,
      });
    } catch (error) {
      console.error('Evaluation Error:', error);
    } finally {
      setIsEvaluating(false);
    }
  };

  return (
    <main className='min-h-screen bg-zinc-50 p-4 md:p-8'>
      <div className='max-w-[1600px] mx-auto'>
        <header className='mb-8'>
          <h1 className='text-3xl font-bold tracking-tight text-indigo-900'>
            RAG System & Evaluation Tool
          </h1>
          <p className='text-zinc-500 mt-1'>
            Adjust generation parameters and run real-time Ragas metric
            evaluations based on the model`&apos;s output.
          </p>
        </header>

        <div className='grid grid-cols-1 xl:grid-cols-4 gap-6'>
          <div className='xl:col-span-1 space-y-6'>
            <Card>
              <CardHeader className='pb-3 border-b mb-4'>
                <CardTitle className='text-lg'>Retrieval Settings</CardTitle>
              </CardHeader>
              <CardContent className='space-y-6'>
                <div className='space-y-2'>
                  <label className='text-sm font-medium mb-2'>
                    Choose Domain Category
                  </label>
                  <Select
                    value={category}
                    onValueChange={(value) => setCategory(value || 'All')}>
                    <SelectTrigger className='w-full mt-2'>
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

                <div>
                  <div className='flex justify-between text-sm mb-2'>
                    <label className='font-medium'>
                      Context Window (ChromaDB n_results)
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
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className='pb-3 border-b mb-4'>
                <CardTitle className='text-lg'>Model Settings</CardTitle>
              </CardHeader>
              <CardContent className='space-y-6'>
                <div className='space-y-2'>
                  <label className='text-sm font-medium'>
                    System Prompt Behavior
                  </label>
                  <Select
                    value={promptType}
                    onValueChange={(value) => {
                      if (value !== null) setPromptType(value);
                    }}>
                    <SelectTrigger className='w-full mt-2'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='hybrid'>
                        Hybrid (Allows Model General Knowledge)
                      </SelectItem>
                      <SelectItem value='strict'>
                        Strict (Pure RAG context only)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

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
                    <label className='font-medium flex items-center gap-1.5'>
                      Top-K Sampling
                      <HoverCard>
                        <HoverCardTrigger>
                          <HelpCircle className='w-4 h-4 text-zinc-400 hover:text-zinc-600 cursor-help transition-colors' />
                        </HoverCardTrigger>
                        <HoverCardContent
                          side='top'
                          className='w-80 bg-zinc-900 text-zinc-200 border-zinc-800 text-sm leading-relaxed shadow-xl'>
                          <strong className='block text-white mb-1'>
                            Top-K Sampling
                          </strong>
                          Περιορίζει τις επιλογές της επόμενης λέξης του
                          Μοντέλου στις `&apos;`K `&apos;` πιο πιθανές επιλογές.
                          <br />
                          <span className='text-zinc-400'>Παράδειγμα:</span> Αν
                          το K=3, τότε το Μοντέλο θα εξετάσει μόνο τις 3 πιο
                          πιθανές επόμενες λέξεις. Μικρές τιμές του Κ (πχ 10-20)
                          οδηγούν σε πιο ασφαλείς και εστιασμένες
                          απαντήσεις.Αντίθετα, μεγάλες τιμές του Κ (πχ 40-100)
                          επιτρέπουν στο Μοντέλο να γίνει πιό εκφραστικό και
                          δημιουργικό χρησιμοποιώντας μεγαλύτερο λεξιλόγιο.
                        </HoverCardContent>
                      </HoverCard>
                    </label>
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
                    <label className='font-medium flex items-center gap-1.5'>
                      Repetition Penalty
                      <HoverCard>
                        <HoverCardTrigger>
                          <HelpCircle className='w-4 h-4 text-zinc-400 hover:text-zinc-600 cursor-help transition-colors' />
                        </HoverCardTrigger>
                        <HoverCardContent className='w-80 bg-zinc-900 text-zinc-200 border-zinc-800 text-sm leading-relaxed shadow-xl'>
                          <strong className='block text-white mb-1'>
                            Repetition Penalty
                          </strong>
                          Εμποδίζει το Μοντέλο να επαναλαμβάνει τις ίδιες λέξεις
                          ή φράσεις.
                          <br />
                          <span className='text-zinc-400'>Παράδειγμα:</span>
                          Μία τιμή κοντά στο 1.0 επιτρέπει στο Μοντέλο να
                          επαναλαμβάνει λέξεις. Μια τιμή κοντά στο 1.2 μειώνει
                          την πιθανότητα επανάληψης λέξεων επιτρέποντας στο
                          Μοντέλο να αναζητά συνώνυμα και διαφορετικές
                          εκφράσεις. Τέλος, μεγάλες τιμές (πχ 1.5+) μπορεί να
                          προκαλέσουν προβλήματα στη γραμματική καθώς το Μοντέλο
                          αποφεύγει να χρησιμοποιεί βασικές λέξεις και
                          συνδέσμους όπως the ή and.
                        </HoverCardContent>
                      </HoverCard>
                    </label>
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
                    max='4000'
                    step='50'
                    value={numPredict}
                    onChange={(e) => setNumPredict(parseInt(e.target.value))}
                    className='w-full accent-zinc-800'
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className='xl:col-span-2'>
            <Card className='w-full h-[80vh] flex flex-col shadow-lg'>
              <CardContent className='flex-1 overflow-hidden p-0'>
                <ScrollArea className='h-full p-6'>
                  <div className='flex flex-col gap-6'>
                    {messages.length === 0 && (
                      <div className='text-center text-zinc-500 mt-20'>
                        Ask a question to test the current parameters of the
                        Model.
                      </div>
                    )}

                    {messages.map((msg, index) => (
                      <div
                        key={index}
                        className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {msg.role === 'assistant' && (
                          <Avatar className='flex items-center justify-center bg-indigo-100'>
                            <BrainIcon className='w-4 h-4 text-indigo-700' />
                          </Avatar>
                        )}

                        <div
                          className={`max-w-[85%] rounded-xl p-5 ${
                            msg.role === 'user'
                              ? 'bg-[#F2F0F0] text-black'
                              : 'bg-white border shadow-sm'
                          }`}>
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

                              {msg.citations && msg.citations.length > 0 && (
                                <div className='mt-6 pt-4 border-t text-xs text-zinc-500'>
                                  <strong className='block mb-2'>
                                    Retrieved Top{' '}
                                    <span className='font-bold'>
                                      {msg.citations.length}
                                    </span>{' '}
                                    Sources:
                                  </strong>
                                  <Accordion
                                    type='single'
                                    collapsible
                                    defaultValue={
                                      msg.citations[0].title || undefined
                                    }>
                                    {msg.citations.map((citation, idx) => (
                                      <AccordionItem
                                        key={idx}
                                        value={citation.title || `doc-${idx}`}>
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
                        <Avatar className='flex items-center justify-center bg-indigo-100'>
                          <BrainIcon className='w-4 h-4 text-indigo-700' />
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
                    disabled={isLoading || isEvaluating}
                    className='flex-1'
                  />
                  <Button
                    type='submit'
                    disabled={isLoading || isEvaluating || !input.trim()}>
                    Send
                  </Button>

                  <Button
                    type='button'
                    variant='outline'
                    onClick={handleEvaluate}
                    disabled={
                      isLoading ||
                      isEvaluating ||
                      messages.length < 2 ||
                      messages[messages.length - 1].role !== 'assistant'
                    }
                    className='border-indigo-200 text-indigo-700 hover:bg-indigo-50'>
                    {isEvaluating ? 'Evaluating...' : 'Evaluate Response'}
                  </Button>
                </form>
              </CardFooter>
            </Card>
          </div>

          <div className='xl:col-span-1 space-y-6'>
            <Card className='h-full bg-zinc-900 text-white shadow-xl'>
              <CardHeader className='pb-4 border-b border-zinc-800'>
                <CardTitle className='text-lg flex items-center gap-2'>
                  <BarChart3Icon className='w-5 h-5 text-indigo-400' />
                  Ragas Metrics Scorecard
                </CardTitle>
              </CardHeader>
              <CardContent className='pt-6 space-y-8'>
                {isEvaluating ? (
                  <div className='text-center text-zinc-400 animate-pulse mt-10'>
                    <BrainIcon className='w-8 h-8 mx-auto mb-3 opacity-50' />
                    <p>Ollama 120B Judge is evaluating the response...</p>
                    <span className='text-sm text-zinc-500'>
                      (This may take a few seconds.)
                    </span>
                  </div>
                ) : evalScores.faithfulness !== null &&
                  evalScores.answer_relevancy !== null ? (
                  <>
                    <div className='space-y-3'>
                      <div className='flex justify-between items-end'>
                        <h3 className='font-medium text-zinc-200'>
                          Faithfulness
                        </h3>
                        <span
                          className={`text-2xl font-mono font-bold ${
                            evalScores.faithfulness >= 0.8
                              ? 'text-green-400'
                              : evalScores.faithfulness >= 0.5
                                ? 'text-yellow-400'
                                : 'text-red-400'
                          }`}>
                          {evalScores.faithfulness.toFixed(2)}
                        </span>
                      </div>
                      <div className='w-full bg-zinc-800 rounded-full h-2'>
                        <div
                          className={`h-2 rounded-full ${
                            evalScores.faithfulness >= 0.8
                              ? 'bg-green-400'
                              : evalScores.faithfulness >= 0.5
                                ? 'bg-yellow-400'
                                : 'bg-red-400'
                          }`}
                          style={{
                            width: `${evalScores.faithfulness * 100}%`,
                          }}></div>
                      </div>
                      <p className='text-xs text-zinc-400'>
                        {evalScores.faithfulness >= 0.8
                          ? 'Strictly grounded in context.'
                          : evalScores.faithfulness >= 0.5
                            ? 'Contains parametric additions.'
                            : 'High hallucination risk.'}
                      </p>
                    </div>

                    <div className='space-y-3'>
                      <div className='flex justify-between items-end'>
                        <h3 className='font-medium text-zinc-200'>
                          Answer Relevancy
                        </h3>
                        <span
                          className={`text-2xl font-mono font-bold ${
                            evalScores.answer_relevancy >= 0.8
                              ? 'text-blue-400'
                              : 'text-orange-400'
                          }`}>
                          {evalScores.answer_relevancy.toFixed(2)}
                        </span>
                      </div>
                      <div className='w-full bg-zinc-800 rounded-full h-2'>
                        <div
                          className={`h-2 rounded-full ${
                            evalScores.answer_relevancy >= 0.8
                              ? 'bg-blue-400'
                              : 'bg-orange-400'
                          }`}
                          style={{
                            width: `${evalScores.answer_relevancy * 100}%`,
                          }}></div>
                      </div>
                      <p className='text-xs text-zinc-400'>
                        Measures how directly the output addresses the user
                        prompt.
                      </p>
                    </div>
                  </>
                ) : (
                  <div className='text-center text-zinc-500 mt-10 text-sm'>
                    Generate a response and click{' '}
                    <strong className='text-zinc-300'>Evaluate</strong> to run
                    LLM-as-a-judge metrics.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}

const preprocessLaTeX = (content: string) => {
  if (!content) return '';
  return content
    .replace(/\\\[([\s\S]*?)\\\]/g, (_match, p1) => `$$${p1}$$`)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_match, p1) => `$${p1}$`)
    .replace(/\\tag{[^}]*}/g, '')
    .replace(
      /\$*\s*(\\begin{[a-zA-Z*]+}[\s\S]*?\\end{[a-zA-Z*]+})\s*\$*/g,
      '\n$$\n$1\n$$\n',
    )
    .replace(
      /\[\s*(\\begin{[\s\S]*?}[\s\S]*?\\end{[\s\S]*?})\s*\]/g,
      '\n$$\n$1\n$$\n',
    )
    .replace(/\\bm{/g, '\\boldsymbol{')
    .replace(/\\_/g, '_')
    .replace(/\\!/g, '')
    .replace(/\\boxed/g, '')
    .replace(/\$\$\s*\$\$/g, '$$')
    .replace(/\$\$([\s\S]*?)\$\$/g, (_match, p1) => `\n$$\n${p1.trim()}\n$$\n`);
};
