// Глобальный промпт авторизации. Любое действие, требующее логина,
// вызывает openAuthPrompt() — всплывает модалка с входом/регистрацией.
import { useEffect, useState } from "react";

type State = { open: boolean; reason?: string; redirect?: string };

let state: State = { open: false };
const listeners = new Set<(s: State) => void>();

function emit() {
  for (const l of listeners) l(state);
}

export function openAuthPrompt(opts?: { reason?: string; redirect?: string }) {
  state = { open: true, reason: opts?.reason, redirect: opts?.redirect };
  emit();
}

export function closeAuthPrompt() {
  state = { ...state, open: false };
  emit();
}

export function useAuthPromptState(): State {
  const [s, setS] = useState<State>(state);
  useEffect(() => {
    const l = (next: State) => setS(next);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return s;
}
