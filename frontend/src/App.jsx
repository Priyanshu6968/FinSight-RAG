import React, { useState, useEffect } from 'react'
import { TrendingUp, Zap, AlertTriangle } from 'lucide-react'
import UploadPanel from './components/UploadPanel'
import ChatPanel from './components/ChatPanel'
import { getDocuments } from './services/api'

function StatusDot({ online }) {
  return (
    <span className="flex items-center gap-1.5 text-xs">
      <span className={`w-1.5 h-1.5 rounded-full ${online ? 'bg-emerald-400' : 'bg-red-400'} animate-pulse`} />
      <span className={online ? 'text-emerald-500' : 'text-red-500'}>
        {online ? 'API Online' : 'API Offline'}
      </span>
    </span>
  )
}

export default function App() {
  const [documents, setDocuments] = useState([])
  const [apiOnline, setApiOnline] = useState(null) // null = checking
  const [loading, setLoading] = useState(true)

  const fetchDocuments = async () => {
    try {
      const data = await getDocuments()
      setDocuments(data.documents || [])
      setApiOnline(true)
    } catch {
      setApiOnline(false)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDocuments()
  }, [])

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(135deg, #050d1a 0%, #0a1628 60%, #050d1a 100%)' }}>
      {/* Ambient background orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #1133f5 0%, transparent 70%)' }} />
        <div className="absolute top-1/3 -right-24 w-80 h-80 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #f59e0b 0%, transparent 70%)' }} />
        <div className="absolute -bottom-20 left-1/3 w-64 h-64 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #2c56ff 0%, transparent 70%)' }} />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-white/5 backdrop-blur-xl"
        style={{ background: 'rgba(5, 13, 26, 0.8)' }}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #1133f5, #2c56ff)', boxShadow: '0 4px 15px rgba(44,86,255,0.4)' }}>
              <TrendingUp size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">
                <span className="text-white">Fin</span>
                <span className="gold-gradient">Sight</span>
                <span className="text-slate-500 text-sm font-normal ml-2">RAG</span>
              </h1>
              <p className="text-xs text-slate-600 -mt-0.5">Investment Document Q&A Engine</p>
            </div>
          </div>

          {/* Status + Badge */}
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/3 border border-white/6">
              <Zap size={12} className="text-gold-400" />
              <span className="text-xs text-slate-500">Powered by GPT-4o + RAG</span>
            </div>
            {apiOnline !== null && <StatusDot online={apiOnline} />}
          </div>
        </div>
      </header>

      {/* Offline Banner */}
      {apiOnline === false && (
        <div className="relative z-10 bg-amber-500/10 border-b border-amber-500/20 px-6 py-2.5 flex items-center gap-2">
          <AlertTriangle size={14} className="text-amber-500 flex-shrink-0" />
          <p className="text-xs text-amber-400">
            Cannot connect to the backend. Make sure <code className="font-mono bg-amber-500/10 px-1 rounded">uvicorn main:app --reload</code> is running on port 8000.
          </p>
        </div>
      )}

      {/* Main Layout */}
      <main className="relative z-10 flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-5 h-[calc(100vh-120px)]">

          {/* Left: Upload Panel */}
          <div className="glass-panel p-5 flex flex-col min-h-0 glow-blue">
            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-2 border-navy-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs text-slate-600">Loading documents…</p>
                </div>
              </div>
            ) : (
              <UploadPanel
                documents={documents}
                setDocuments={setDocuments}
                onDocumentsChange={fetchDocuments}
              />
            )}
          </div>

          {/* Right: Chat Panel */}
          <div className="glass-panel p-5 flex flex-col min-h-0">
            <ChatPanel documents={documents} />
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 py-3 px-6 text-center">
        <p className="text-xs text-slate-700">
          FinSight RAG — Answers grounded in your documents · Built with GPT-4o + LangChain + Pinecone
        </p>
      </footer>
    </div>
  )
}
