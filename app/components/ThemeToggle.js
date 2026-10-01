//app/components/ThemeToggle.js
"use client";

import { useEffect, useState } from 'react';
import { FaSun, FaMoon } from 'react-icons/fa';

export default function ThemeToggle({ className = "" }) {
  const [theme, setTheme] = useState('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('theme') || 'dark';
    setTheme(saved);
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(newTheme);
  };

  if (!mounted) {
    return <div className={`w-10 h-10 ${className}`} />; // placeholder to avoid layout shift
  }

  return (
    <button
      onClick={toggleTheme}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label="Toggle theme"
      className={`relative inline-flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-300 transform hover:scale-110 active:scale-95 ${
        theme === 'dark'
          ? 'bg-amber-400/20 text-amber-300 hover:bg-amber-400/30'
          : 'bg-indigo-100 text-indigo-600 hover:bg-indigo-200'
      } ${className}`}
    >
      <span
        className="text-lg transition-transform duration-500"
        style={{ transform: theme === 'dark' ? 'rotate(0deg)' : 'rotate(180deg)' }}
      >
        {theme === 'dark' ? <FaSun /> : <FaMoon />}
      </span>
    </button>
  );
}