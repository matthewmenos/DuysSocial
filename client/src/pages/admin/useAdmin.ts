import { useEffect, useState } from "react";
import { api } from "../../api";

export function useAdmin(path: string) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const load = () => {
    setError("");
    return api(path)
      .then((d) => { setData(d); setError(""); })
      .catch((ex) => setError((ex as Error).message || "Request failed."));
  };
  useEffect(() => { void load(); }, [path]);
  return { data, load, error };
}

