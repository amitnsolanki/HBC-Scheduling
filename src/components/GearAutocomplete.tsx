import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

interface GearAutocompleteProps {
  type: 'racket' | 'shoe' | 'string';
  value: string;
  onChange: (value: string, extraInfo?: any) => void;
  placeholder: string;
  className?: string;
}

export default function GearAutocomplete({ type, value, onChange, placeholder, className }: GearAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [allGear, setAllGear] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchPromise = useRef<Promise<any[]> | null>(null);

  const fetchGear = async () => {
    if (allGear.length > 0) return allGear;
    if (fetchPromise.current) return fetchPromise.current;
    
    setLoading(true);
    fetchPromise.current = (async () => {
      try {
        const q = query(collection(db, 'gear'), where('type', '==', type));
        const querySnapshot = await getDocs(q);
        const gear: any[] = [];
        querySnapshot.forEach((doc) => {
          gear.push({ id: doc.id, ...doc.data() });
        });
        setAllGear(gear);
        return gear;
      } catch (error) {
        console.error('Error fetching gear:', error);
        return [];
      } finally {
        setLoading(false);
        fetchPromise.current = null;
      }
    })();
    
    return fetchPromise.current;
  };

  useEffect(() => {
    // Reset state when type changes
    setAllGear([]);
    setSuggestions([]);
    fetchGear();
  }, [type]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(val);

    if (val.length >= 1) {
      setShowSuggestions(true);
      
      let currentGear = allGear;
      if (currentGear.length === 0) {
        currentGear = await fetchGear();
      }

      const searchTerms = val.toLowerCase().split(' ').filter(term => term.length > 0);
      const results = currentGear.filter(item => {
        const searchableText = [
          item.brand,
          item.model,
          item.series,
          item.characteristic,
          item.player_level,
          item.cushion_technology,
          item.balance,
          item.flex,
          item.gauge_mm?.toString()
        ].filter(Boolean).join(' ').toLowerCase();
        
        return searchTerms.every(term => searchableText.includes(term));
      });
      
      setSuggestions(results);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSelect = (item: any) => {
    const fullName = `${item.brand} ${item.model}`;
    onChange(fullName, item);
    setShowSuggestions(false);
  };

  return (
    <div className="relative" ref={containerRef}>
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={() => {
            if (value.length >= 1 && suggestions.length > 0) {
              setShowSuggestions(true);
            } else if (allGear.length === 0) {
              fetchGear();
            }
          }}
          placeholder={placeholder}
          className={className}
          autoComplete="off"
          spellCheck="false"
        />
        {loading && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
      </div>
      {showSuggestions && (
        <div className="absolute left-0 right-0 z-[100] mt-1 bg-white border border-slate-200 rounded-lg shadow-2xl max-h-60 overflow-auto ring-1 ring-black ring-opacity-5">
          {suggestions.length > 0 ? (
            suggestions.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item)}
                className="w-full px-4 py-2 text-left hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0"
              >
                <div className="font-medium text-slate-900">{item.brand} {item.model}</div>
                {type === 'racket' && item.series && (
                  <div className="text-xs text-slate-500">{item.series} • {item.balance} • {item.flex}</div>
                )}
                {type === 'shoe' && item.player_level && (
                  <div className="text-xs text-slate-500">{item.player_level} • {item.cushion_technology}</div>
                )}
                {type === 'string' && item.gauge_mm && (
                  <div className="text-xs text-slate-500">{item.gauge_mm}mm • {item.characteristic}</div>
                )}
              </button>
            ))
          ) : value.length >= 2 && !loading ? (
            <div className="px-4 py-3 text-sm text-slate-500 italic">
              {allGear.length === 0 
                ? `No ${type} data available in database. Please seed it in Admin.` 
                : `No matching ${type}s found in database.`}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
