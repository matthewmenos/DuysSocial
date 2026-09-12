import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../../api";

export function StoriesPage() {
  const { username } = useParams();
  const [stories, setStories] = useState<any[]>([]);
  useEffect(() => { api(`/api/stories/u/${username}`).then((d) => setStories(d.stories)); }, [username]);
  return (
    <div>
      {stories.map((s) => (
        <div key={s.id}>
          {s.mediaKind === "video" ? <video src={s.mediaUrl} controls /> : <img src={s.mediaUrl} alt="" />}
          <p>{s.caption}</p>
        </div>
      ))}
    </div>
  );
}
