import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

const ToastContext = createContext();

export const useToast = () => useContext(ToastContext);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(0);

  // Stable identity: hooks list `toast` in dependency arrays, and a new
  // function each render would re-fire their effects.
  const toast = useCallback((message, variant = "info") => {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast is-${t.variant}`}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
