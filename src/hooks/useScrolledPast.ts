import { useEffect, useRef, useState } from "react";

export function useScrolledPast() {
  const ref = useRef<HTMLDivElement>(null);
  const [scrolledPast, setScrolledPast] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setScrolledPast(!entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, scrolledPast };
}
