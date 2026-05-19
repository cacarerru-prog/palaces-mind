/**
 * SearchResult.jsx — одна карточка результата поиска.
 *
 * Показывает тему, подтему и краткую суть. По клику разворачивает
 * подробное описание и ключевые слова.
 */

import { useState } from 'react'

export default function SearchResult({ node }) {
  // expanded — раскрыта ли карточка с подробностями.
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      onClick={() => setExpanded(!expanded)}
      className="bg-surface rounded-xl p-4 cursor-pointer hover:ring-1 hover:ring-accent transition"
    >
      {/* Тема → подтема. */}
      <div className="text-xs text-accent font-medium mb-1">
        {node.topic} → {node.subtopic}
      </div>

      {/* Краткая суть. */}
      <div className="text-gray-100">{node.summary}</div>

      {/* Подробности — видны только когда карточка раскрыта. */}
      {expanded && (
        <div className="mt-3 border-t border-bg pt-3">
          {node.detail && (
            <p className="text-sm text-gray-300 whitespace-pre-wrap">
              {node.detail}
            </p>
          )}
          {node.keywords?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {node.keywords.map((kw) => (
                <span
                  key={kw}
                  className="text-xs bg-bg px-2 py-0.5 rounded text-gray-400"
                >
                  {kw}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
