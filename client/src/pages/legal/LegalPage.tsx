import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../../api";

export function LegalPage() {
  const { page } = useParams();
  const [data, setData] = useState<{ title: string; body: string } | null>(null);
  useEffect(() => { api(`/api/legal/${page}`).then(setData); }, [page]);
  return <div className="legal"><h1>{data?.title}</h1><p>{data?.body}</p></div>;
}
