import '@/styles/components/SearchField.css';

export default function SearchField({ value, onChange, placeholder, label = 'Search listings' }) {
  return (
    <label className="listing-search">
      <span className="listing-search-icon" aria-hidden="true">⌕</span>
      <span className="sr-only">{label}</span>
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
      />
      {value && <button type="button" onClick={() => onChange('')} aria-label="Clear search">Clear</button>}
    </label>
  );
}