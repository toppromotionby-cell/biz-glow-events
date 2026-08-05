// Sync localStorage cart with cart_drafts table for authenticated users.
// Mounted once at root. SSR-safe (does nothing during SSR).
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { clampQty, type CartItem } from "@/lib/cart";

const KEY = "eh_cart_v1";
const EVT = "cart:change";

function readLocal(): CartItem[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter(Boolean) : [];
  } catch { return []; }
}

function writeLocal(items: CartItem[]) {
  window.localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent(EVT));
}

function mergeCarts(a: CartItem[], b: CartItem[]): CartItem[] {
  const map = new Map<string, CartItem>();
  for (const it of [...a, ...b]) {
    const k = `${it.entity_type}::${it.id}`;
    const cur = map.get(k);
    if (cur) {
      map.set(k, { ...cur, qty: clampQty(cur, Math.max(cur.qty, it.qty)) });
    } else {
      map.set(k, { ...it, qty: clampQty(it, it.qty) });
    }
  }
  return Array.from(map.values());
}

export function CartSync() {
  const userIdRef = useRef<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialMergedRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    async function pullAndMerge(userId: string) {
      try {
        const { data } = await supabase
          .from("cart_drafts")
          .select("items")
          .eq("user_id", userId)
          .maybeSingle();
        if (!mounted) return;
        const remote = (Array.isArray(data?.items) ? data!.items : []) as CartItem[];
        const local = readLocal();
        const merged = mergeCarts(remote, local);
        writeLocal(merged);
        // Push merged back so DB reflects union
        await supabase.from("cart_drafts").upsert({ user_id: userId, items: merged });
      } catch {
        // ignore
      }
    }

    function pushLocalDebounced() {
      const userId = userIdRef.current;
      if (!userId) return;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        try {
          const items = readLocal();
          await supabase.from("cart_drafts").upsert({ user_id: userId, items });
        } catch {
          // ignore
        }
      }, 800);
    }

    // Initial session check
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      const uid = data.session?.user?.id ?? null;
      userIdRef.current = uid;
      if (uid && !initialMergedRef.current) {
        initialMergedRef.current = true;
        pullAndMerge(uid);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const uid = session?.user?.id ?? null;
      const prev = userIdRef.current;
      userIdRef.current = uid;
      if (uid && uid !== prev) {
        initialMergedRef.current = true;
        pullAndMerge(uid);
      }
      if (!uid && event === "SIGNED_OUT") {
        // Keep localStorage as guest cart
      }
    });

    const onChange = () => pushLocalDebounced();
    window.addEventListener(EVT, onChange);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      window.removeEventListener(EVT, onChange);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return null;
}
