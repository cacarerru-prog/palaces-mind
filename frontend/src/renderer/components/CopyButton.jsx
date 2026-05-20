/**
 * CopyButton.jsx — универсальная кнопка «копировать в буфер обмена».
 *
 * После клика на 1.2 секунды показывает галочку, потом возвращается
 * к иконке. Принимает либо готовый текст в props.text, либо функцию
 * props.getText, которую вызовет в момент клика.
 */

import { useState } from 'react'

export default function CopyButton({
  text,
  getText,
  label = 'Копировать',
  className = '',
  compact = false,
}) {
  const [done, setDone] = useState(false)

  async function handleClick(e) {
    // Не даём клику пробрасываться (например, не разворачивать карточку).
    e.stopPropagation()
    const value = (typeof getText === 'function' ? getText() : text) || ''
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      setDone(true)
      setTimeout(() => setDone(false), 1200)
    } catch (_) {
      // Резервный вариант — через document.execCommand (на старых движках).
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
          'shrink-0 px-1.5 py-0.5 rounded text-xs text-gray-400 ' +
          'hover:bg-bg hover:text-gray-100 transition ' + className
        }
      >
        {done ? '✓' : '⧉'}
      </button>
    )
  }

  // Полноразмерная кнопка с текстом.
  return (
    <button
      onClick={handleClick}
      className={
        'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs ' +
        'bg-bg text-gray-300 hover:bg-accent hover:text-white transition ' +
        className
      }
    >
      <span>{done ? '✓' : '⧉'}</span>
      <span>{done ? 'Скопировано' : label}</span>
    </button>
  )
}
