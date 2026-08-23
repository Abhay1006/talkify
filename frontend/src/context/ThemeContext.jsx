import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "talkify-theme";
const ThemeContext = createContext();

export const useTheme = () => useContext(ThemeContext);

// `null` means "follow the system", which is also the default. The stylesheet
// handles that case on its own, so nothing is written to <html> until the user
// actually picks a side.
const stored = () => {
  const value = localStorage.getItem(STORAGE_KEY);
  return value === "light" || value === "dark" ? value : null;
};

const systemPrefersDark = () =>
  window.matchMedia("(prefers-color-scheme: dark)").matches;

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(stored);

  useEffect(() => {
    if (theme) {
      document.documentElement.setAttribute("data-theme", theme);
      localStorage.setItem(STORAGE_KEY, theme);
    } else {
      document.documentElement.removeAttribute("data-theme");
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((current) => {
      const effective = current || (systemPrefersDark() ? "dark" : "light");
      return effective === "dark" ? "light" : "dark";
    });
  }, []);

  // What the user is actually looking at, for the toggle's label.
  const [systemDark, setSystemDark] = useState(systemPrefersDark);
  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e) => setSystemDark(e.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const isDark = theme ? theme === "dark" : systemDark;
  const value = useMemo(() => ({ isDark, toggle }), [isDark, toggle]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};
