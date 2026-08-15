import { memo } from 'react'

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

function AlphabetFilter({ active = '', onChange }) {
  const select = (letter) => onChange(letter)
  return (
    <nav className="alpha-bar" aria-label="Filtrar animes por letra inicial">
      <button
        type="button"
        className={active === '' ? 'alpha-chip active' : 'alpha-chip'}
        aria-pressed={active === ''}
        onClick={() => select('')}
      >
        Todos
      </button>
      {LETTERS.map((l) => (
        <button
          key={l}
          type="button"
          className={active === l ? 'alpha-chip active' : 'alpha-chip'}
          aria-pressed={active === l}
          onClick={() => select(l)}
        >
          {l}
        </button>
      ))}
      <button
        type="button"
        className={active === '#' ? 'alpha-chip active' : 'alpha-chip'}
        aria-pressed={active === '#'}
        onClick={() => select('#')}
      >
        #
      </button>
    </nav>
  )
}

export default memo(AlphabetFilter)
