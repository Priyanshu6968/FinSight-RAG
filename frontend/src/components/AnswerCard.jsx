import React from 'react'
import { FileText, TrendingUp } from 'lucide-react'

const CONFIDENCE_CONFIG = {
  high: {
    label: 'High Confidence',
    color: 'bg-emerald-500',
    textColor: 'text-emerald-400',
    width: '90%',
    dot: 'bg-emerald-400',
  },
  medium: {
    label: 'Medium Confidence',
    color: 'bg-gold-500',
    textColor: 'text-gold-400',
    width: '55%',
    dot: 'bg-gold-400',
  },
  low: {
    label: 'Low Confidence',
    color: 'bg-red-500',
    textColor: 'text-red-400',
    width: '25%',
    dot: 'bg-red-400',
  },
}

function ConfidenceBar({ confidence, avgScore }) {
  const cfg = CONFIDENCE_CONFIG[confidence] || CONFIDENCE_CONFIG.low
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} animate-pulse`} />
        <span className={`text-xs font-medium ${cfg.textColor}`}>{cfg.label}</span>
        <span className="text-xs text-slate-600">({(avgScore * 100).toFixed(0)}%)</span>
      </div>
      <div className="flex-1 confidence-bar">
        <div
          className={`h-full rounded-full ${cfg.color} transition-all duration-700`}
          style={{ width: cfg.width }}
        />
      </div>
    </div>
  )
}

function SourceBadge({ filename, page }) {
  return (
    <span className="source-badge">
      <FileText size={10} />
      {filename}
      {page ? ` — Page ${page}` : ''}
    </span>
  )
}

function MessageBubble({ text }) {
  // Render markdown-style bold and inline code
  const rendered = text
    .split('\n')
    .map((line, i) => {
      const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
      return (
        <span key={i}>
          {parts.map((part, j) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return <strong key={j} className="font-semibold text-slate-100">{part.slice(2, -2)}</strong>
            }
            if (part.startsWith('`') && part.endsWith('`')) {
              return <code key={j} className="font-mono text-xs bg-white/5 px-1 py-0.5 rounded text-gold-400">{part.slice(1, -1)}</code>
            }
            return part
          })}
          {i < text.split('\n').length - 1 && <br />}
        </span>
      )
    })
  return <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{rendered}</p>
}

export default function AnswerCard({ answer, sources, confidence, avgScore, index }) {
  const cfg = CONFIDENCE_CONFIG[confidence] || CONFIDENCE_CONFIG.low

  return (
    <div
      className="glass-panel p-5 animate-slide-up glow-blue"
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      {/* Answer Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-navy-500 to-blue-500 flex items-center justify-center flex-shrink-0">
            <TrendingUp size={12} className="text-white" />
          </div>
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">FinSight Answer</span>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.textColor} bg-current/10`}
          style={{ backgroundColor: `${cfg.dot}1a` }}>
          {cfg.label}
        </span>
      </div>

      {/* Answer Text */}
      <div className="mb-4">
        <MessageBubble text={answer} />
      </div>

      {/* Confidence Bar */}
      {avgScore > 0 && (
        <div className="mb-4 pb-4 border-b border-white/5">
          <ConfidenceBar confidence={confidence} avgScore={avgScore} />
        </div>
      )}

      {/* Source Citations */}
      {sources && sources.length > 0 && (
        <div>
          <p className="text-xs text-slate-600 mb-2 uppercase tracking-wider font-medium">Sources</p>
          <div className="flex flex-wrap gap-2">
            {sources.map((src, i) => (
              <SourceBadge
                key={`${src.filename}-${src.page}-${i}`}
                filename={src.filename}
                page={src.page}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
