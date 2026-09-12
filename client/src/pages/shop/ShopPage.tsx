import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../../api";

export function ShopPage() {
  const { username } = useParams();
  const [data, setData] = useState<any>(null);
  const load = () => api(`/api/shop/${username}`).then(setData);
  useEffect(() => { load(); }, [username]);
  return (
    <div>
      <h2>Shop · @{username}</h2>
      {data?.listings.map((l: any) => (
        <div key={l.id}>
          <strong>{l.title}</strong> · {l.priceDuys}
          <button className="btn" onClick={() => api(`/api/shop/listings/${l.id}/buy`, { method: "POST", body: "{}" }).then(load)}>Buy</button>
        </div>
      ))}
    </div>
  );
}
