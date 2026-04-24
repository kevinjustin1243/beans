import { useEffect, useMemo, useRef, useState } from "react";
import { useAccounts } from "../lib/accounts";

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  onEnter?: () => void;
}

const DEFAULT_CLS =
  "border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full font-mono";

const MAX_MATCHES = 12;

export function AccountInput({
  value,
  onChange,
  placeholder,
  className,
  required,
  disabled,
  autoFocus,
  onEnter,
}: Props) {
  const accounts = useAccounts();
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => {
    const q = value.toLowerCase().trim();
    if (!q) return accounts.slice(0, MAX_MATCHES);
    return accounts.filter((a) => a.toLowerCase().includes(q)).slice(0, MAX_MATCHES);
  }, [value, accounts]);

  // Reset highlight when matches change
  useEffect(() => { setHighlighted(-1); }, [value]);

  // Close on outside click
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function selectMatch(account: string) {
    onChange(account);
    setOpen(false);
    setHighlighted(-1);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlighted((h) => (matches.length === 0 ? -1 : (h + 1) % matches.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (matches.length === 0) return;
      setHighlighted((h) => (h <= 0 ? matches.length - 1 : h - 1));
    } else if (e.key === "Enter") {
      // Only intercept Enter if user has navigated into the dropdown (highlighted >= 0).
      // Otherwise, let the form submit (or onEnter fire).
      if (open && highlighted >= 0 && matches[highlighted]) {
        e.preventDefault();
        selectMatch(matches[highlighted]);
      } else if (onEnter) {
        e.preventDefault();
        onEnter();
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setHighlighted(-1);
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  }

  function renderHighlight(account: string) {
    const q = value.toLowerCase().trim();
    if (!q) return account;
    const idx = account.toLowerCase().indexOf(q);
    if (idx === -1) return account;
    return (
      <>
        {account.slice(0, idx)}
        <span className="font-semibold text-indigo-600">{account.slice(idx, idx + q.length)}</span>
        {account.slice(idx + q.length)}
      </>
    );
  }

  const exists = accounts.includes(value.trim());
  const hasInput = value.trim().length > 0;

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        autoFocus={autoFocus}
        autoComplete="off"
        spellCheck={false}
        className={className ?? DEFAULT_CLS}
      />
      {open && matches.length > 0 && (
        <ul className="absolute z-50 mt-1 left-0 right-0 max-h-64 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg">
          {matches.map((acc, i) => (
            <li
              key={acc}
              onMouseDown={(e) => { e.preventDefault(); selectMatch(acc); }}
              onMouseEnter={() => setHighlighted(i)}
              className={`px-3 py-1.5 text-xs font-mono cursor-pointer ${
                i === highlighted ? "bg-indigo-50 text-indigo-700" : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              {renderHighlight(acc)}
            </li>
          ))}
          {hasInput && !exists && (
            <li className="px-3 py-1.5 text-xs text-slate-400 italic border-t border-slate-100">
              Press Tab or click away to use "{value.trim()}" as a new account
            </li>
          )}
        </ul>
      )}
      {open && matches.length === 0 && hasInput && (
        <div className="absolute z-50 mt-1 left-0 right-0 px-3 py-2 bg-white border border-slate-200 rounded-lg shadow-lg text-xs text-slate-400 italic">
          Will create new account "{value.trim()}"
        </div>
      )}
    </div>
  );
}
