import { Link } from "react-router-dom";
import { useAdmin } from "./useAdmin";

export function AdminUsers() {
  const { data, load } = useAdmin("/api/admin/users");
  return (
    <div>
      <h1>Users</h1>
      <table>
        <tbody>
          {data?.users?.map((u: any) => (
            <tr key={u.id}>
              <td><Link to={`/admin/users/${u.id}`}>@{u.username}</Link></td>
              <td>{u.points}</td>
              <td>{u.verifiedBadge}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className="btn" onClick={load}>Refresh</button>
    </div>
  );
}
