import React, { useState, useRef, useEffect } from 'react'
import { Send, MessageSquare, Loader2, Sparkles, RotateCcw, ChevronDown } from 'lucide-react'
import { queryDocuments } from '../services/api'
import AnswerCard from './AnswerCard'

const EXAMPLE_QUESTIONS = [
  'What is the total revenue for the fiscal year?',
  'What are the key risk factors mentioned?',
  'What is the net profit margin?',
  'Who are the major shareholders?',
  'What is the debt-to-equity ratio?',
]

function UserMessage({ text }) {
  return (
    <div className="flex justify-end animate-slide-up">
      <div className="max-w-[80%] px-4 py-3 rounded-2xl rounded-tr-sm text-sm text-slate-100 leading-relaxed"
        style={{ background: 'linear-gradient(135deg, #1133f5, #2c56ff)', boxShadow: '0 4px 15px rgba(44,86,255,0.25)' }}>
        {text}
      </div>
    </div>
  )
}

function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-3 animate-fade-in">
      <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-navy-700 to-navy-600 flex items-center justify-center flex-shrink-0">
        <Sparkles size={13} className="text-gold-400 animate-pulse" />
      </div>
      <div className="glass-panel-light px-4 py-3 flex items-center gap-2">
        <span className="text-xs text-slate-500">FinSight is analysing your documents</span>
        <div className="flex gap-1 ml-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-1 h-1 rounded-full bg-slate-500"
              style={{ animation: `pulse 1.4s ease-in-out ${i * 0.2}s infinite` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export default function ChatPanel({ documents }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [filterDoc, setFilterDoc] = useState('')
  const [mode, setMode] = useState('fast')
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const handleSubmit = async (question = input.trim()) => {
    if (!question || loading) return

    setInput('')
    setError(null)
    setMessages((prev) => [...prev, { type: 'user', text: question }])
    setLoading(true)

    try {
      const result = await queryDocuments(question, filterDoc || null, mode)
      setMessages((prev) => [
        ...prev,
        {
          type: 'answer',
          ...result,
        },
      ])
    } catch (err) {
      const detail = err?.response?.data?.detail || err.message || 'Query failed. Please try again.'
      setError(detail)
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleClear = () => {
    setMessages([])
    setError(null)
  }

  const isEmpty = messages.length === 0 && !loading

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-navy-500/20 flex items-center justify-center">
            <MessageSquare size={16} className="text-navy-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-100">Q&A Chat</h2>
            <p className="text-xs text-slate-500">Ask anything about your documents</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Mode Toggle */}
          <div className="flex bg-white/5 rounded-lg p-1 border border-white/5">
            <button
              onClick={() => setMode('fast')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${mode === 'fast' ? 'bg-navy-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
              title="Fast answering without reranking"
            >
              Fast
            </button>
            <button
              onClick={() => setMode('accurate')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all flex flex-col items-center justify-center ${mode === 'accurate' ? 'bg-navy-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
              title="More accurate answering with Cohere reranking"
            >
              <span>Accurate</span>
              <span className="text-[9px] font-normal opacity-70 mt-0.5">(reranking)</span>
            </button>
          </div>

          {/* Document filter */}
          {documents.length > 1 && (
            <div className="relative">
              <select
                id="filter-doc-select"
                value={filterDoc}
                onChange={(e) => setFilterDoc(e.target.value)}
                className="appearance-none pl-3 pr-7 py-1.5 rounded-lg text-xs font-medium
                           bg-white/5 border border-white/8 text-slate-400
                           hover:border-white/15 transition-all outline-none cursor-pointer"
              >
                <option value="">All Documents</option>
                {documents.map((d) => (
                  <option key={d.doc_id} value={d.doc_id}>{d.filename}</option>
                ))}
              </select>
              <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            </div>
          )}

          {messages.length > 0 && (
            <button
              id="clear-chat-btn"
              onClick={handleClear}
              className="btn-ghost text-xs flex items-center gap-1.5"
              title="Clear conversation"
            >
              <RotateCcw size={12} />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-4 min-h-0">
        {isEmpty && (
          <div className="flex flex-col items-center justify-center h-full text-center py-8 animate-fade-in">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-navy-800 to-dark-700
                            flex items-center justify-center mb-4 glow-blue">
              <Sparkles size={28} className="text-gold-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-200 mb-1">Ask FinSight</h3>
            <p className="text-sm text-slate-500 max-w-xs leading-relaxed mb-6">
              Upload financial documents and ask questions. Every answer is grounded in your documents.
            </p>
            {documents.length === 0 && (
              <p className="text-xs text-amber-500/70 bg-amber-500/10 px-4 py-2 rounded-lg border border-amber-500/20">
                ← Upload a document first to start asking questions
              </p>
            )}
            {documents.length > 0 && (
              <div className="w-full max-w-sm space-y-2">
                <p className="text-xs text-slate-600 uppercase tracking-wider font-medium mb-3">Try asking…</p>
                {EXAMPLE_QUESTIONS.map((q, i) => (
                  <button
                    key={i}
                    id={`example-q-${i}`}
                    onClick={() => handleSubmit(q)}
                    className="w-full text-left px-4 py-2.5 rounded-xl text-xs text-slate-400
                               bg-white/3 border border-white/5 hover:border-white/10
                               hover:text-slate-300 hover:bg-white/5 transition-all duration-200"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i}>
            {msg.type === 'user' ? (
              <UserMessage text={msg.text} />
            ) : (
              <AnswerCard
                answer={msg.answer}
                sources={msg.sources}
                confidence={msg.confidence}
                avgScore={msg.avg_score}
                index={i}
              />
            )}
          </div>
        ))}

        {loading && <ThinkingIndicator />}

        {error && (
          <div className="glass-panel-light p-4 border border-red-500/20 animate-slide-up">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="relative">
        <textarea
          ref={inputRef}
          id="question-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            documents.length === 0
              ? 'Upload a document first…'
              : 'Ask a question about your financial documents…'
          }
          disabled={loading || documents.length === 0}
          rows={2}
          className="input-field resize-none pr-14 text-sm leading-relaxed
                     disabled:opacity-40 disabled:cursor-not-allowed"
        />
        <button
          id="send-question-btn"
          onClick={() => handleSubmit()}
          disabled={!input.trim() || loading || documents.length === 0}
          className="absolute right-3 bottom-3 w-9 h-9 rounded-lg flex items-center justify-center
                     transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
          style={{
            background: input.trim() && !loading
              ? 'linear-gradient(135deg, #1133f5, #2c56ff)'
              : 'rgba(255,255,255,0.05)',
            boxShadow: input.trim() && !loading ? '0 4px 12px rgba(44,86,255,0.35)' : 'none',
          }}
          title="Send question (Enter)"
        >
          {loading ? (
            <Loader2 size={16} className="animate-spin text-slate-400" />
          ) : (
            <Send size={15} className={input.trim() ? 'text-white' : 'text-slate-600'} />
          )}
        </button>
        <p className="text-xs text-slate-700 mt-1.5 text-right pr-1">
          Press <kbd className="px-1 py-0.5 rounded text-slate-600 bg-white/5 font-mono text-xs">Enter</kbd> to send
        </p>
      </div>
    </div>
  )
}
