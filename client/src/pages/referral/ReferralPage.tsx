import { useEffect, useState } from "react";
import { api } from "../../api";

export function ReferralPage() {
  const [data, setData] = useState<any>(null);
  useEffect(() => { api("/api/referral").then(setData); }, []);
  const link = `${window.location.origin}/auth/login?tab=signup&ref=${data?.code || ""}`;
  return (
    <div>
      <h2>Referrals</h2>
      <p>Your code is <strong>{data?.code}</strong></p>
      <input readOnly value={link} />
      <p>{data?.count} signups</p>
    </div>
  );
}
