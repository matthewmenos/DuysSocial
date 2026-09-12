import { useEffect, useState } from "react";
import { api } from "../../api";

export function useAdmin(path: string) {
  const [data, setData] = useState<any>(null);
  const load = () => api(path).then(setData);
  useEffect(() => { load(); }, [path]);
  return { data, load };
}
