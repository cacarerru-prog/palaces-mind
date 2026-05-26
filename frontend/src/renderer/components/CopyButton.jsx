/**
 * CopyButton.jsx — универсальная кнопка «копировать в буфер обмена».
 *
 * После клика на 1.2 секунды показывает галочку, потом возвращается
 * к иконке. Принимает либо готовый текст в props.text, либо функцию
 * props.getText, которую вызовет в момент клика.
 */

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

export default function CopyButton({
  text,
  getText,
  label = 'Копировать',
  className = '',
  compact = false,
}) {
  const [done, setDone] = useState(false)

  async function handleClick(e) {
    e.stopPropagation()
    const value = (typeof getText === 'function' ? getText() : text) || ''
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      setDone(true)
      setTimeout(() => setDone(false), 1200)
    } catch (_) {
      const ta = document.createElement('textarea')
      ta.value = value
      document.body.appendChild(ta)
      ta.select()
      try { document.execCommand('copy') } catch (_) {}
      document.body.removeChild(ta)
      setDone(true)
      setTimeout(() => setDone(false), 1200)
    }
  }

  // Компактная иконка-кнопка (для шапок карточек).
  if (compact) {
    return (
      <button
        onClick={handleClick}
        title={label}
        className={
          'shrink-0 w-6 h-6 flex items-center justify-center rounded ' +
          'text-text-muted hover:bg-surface-2 hover:text-text transition-colors ' +
          (done ? 'text-success ' : '') + className
        }
      >
        {done
          ? <Check size={12} strokeWidth={2} />
          : <Copy size={12} strokeWidth={1.75} />}
      </button>
    )
  }

  // Полноразмерная кнопка с текстом.
  return (
    <button
      onClick={handleClick}
      className={
        'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs border ' +
        (done
          ? 'border-success/40 bg-success/10 text-success '
          : 'border-border bg-bg text-text-muted hover:bg-surface-2 hover:text-text hover:border-border-strong ') +
        'transition-colors ' + className
      }
    >
      {done
        ? <Check size={12} strokeWidth={2} />
        : <Copy size={12} strokeWidth={1.75} />}
      <span>{done ? 'Скопировано' : label}</span>
    </button>
  )
}
