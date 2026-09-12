import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../../api";

export function StartDm() {
  const { username } = useParams();
  const nav = useNavigate();
  useEffect(() => {
    api(`/api/messages/start/${username}`, { method: "POST", body: "{}" }).then((d) => nav(`/messages/${d.conversationId}`));
  }, [username]);
  return <p>Opening chat…</p>;
}
