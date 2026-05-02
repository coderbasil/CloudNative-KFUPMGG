import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../pages-css/Admin.css";

export default function AdminPage() {
  const navigate = useNavigate();
  const [token, setToken] = useState(null);
  const [tab, setTab] = useState("photos");

  const [photos, setPhotos] = useState([]);
  const [photosLoading, setPhotosLoading] = useState(true);

  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [newUser, setNewUser] = useState({ username: "", email: "", password: "", type: "player" });
  const [userMsg, setUserMsg] = useState(null);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("kfupm_user") || "{}");
      if (stored.role !== "admin" || !stored.token) {
        navigate("/login");
        return;
      }
      setToken(stored.token);
    } catch {
      navigate("/login");
    }
  }, [navigate]);

  useEffect(() => {
    if (!token) return;
    fetch("/api/photos")
      .then((r) => r.json())
      .then(setPhotos)
      .catch(() => {})
      .finally(() => setPhotosLoading(false));
  }, [token]);

  useEffect(() => {
    if (tab !== "users" || !token) return;
    setUsersLoading(true);
    fetch("/api/admins", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then(setUsers)
      .catch(() => {})
      .finally(() => setUsersLoading(false));
  }, [tab, token]);

  const updateStatus = (id, status) => {
    fetch(`/api/photos/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)));
  };

  const deleteUser = (id) => {
    fetch(`/api/admins/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    setUsers((prev) => prev.filter((u) => u.id !== id));
  };

  const createUser = async (e) => {
    e.preventDefault();
    setUserMsg(null);
    try {
      const res = await fetch("/api/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(newUser),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to create user");
      setUsers((prev) => [data, ...prev]);
      setNewUser({ username: "", email: "", password: "", type: "player" });
      setUserMsg({ ok: true, text: "User created successfully" });
    } catch (err) {
      setUserMsg({ ok: false, text: err.message });
    }
  };

  const statusBadge = (s) =>
    s === "Approved" ? "badge-approved" : s === "Rejected" ? "badge-rejected" : "badge-pending";

  if (!token) return null;

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div className="admin-header-left">
          <img src="/assets/kfupm-logo.png" alt="KFUPM" className="admin-logo" />
          <span className="admin-title">Admin Panel</span>
        </div>
        <button className="admin-logout" onClick={() => { localStorage.removeItem("kfupm_user"); navigate("/login"); }}>
          Log Out
        </button>
      </header>

      <div className="admin-tabs">
        <button className={`admin-tab ${tab === "photos" ? "active" : ""}`} onClick={() => setTab("photos")}>
          Photo Requests
        </button>
        <button className={`admin-tab ${tab === "users" ? "active" : ""}`} onClick={() => setTab("users")}>
          User Accounts
        </button>
      </div>

      <div className="admin-content">

        {tab === "photos" && (
          photosLoading ? <p className="admin-loading">Loading…</p> : (
            <div className="table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Preview</th>
                    <th>Location</th>
                    <th>Difficulty</th>
                    <th>Photographer</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {photos.map((p) => (
                    <tr key={p.id}>
                      <td>{p.id}</td>
                      <td>
                        <img src={p.url} alt="" className="admin-thumb" />
                      </td>
                      <td>{p.location_name || "—"}</td>
                      <td>{p.diff || "—"}</td>
                      <td>{p.photographer || "—"}</td>
                      <td>
                        <span className={`badge ${statusBadge(p.status)}`}>{p.status}</span>
                      </td>
                      <td className="row-actions">
                        <button
                          className="btn-approve"
                          onClick={() => updateStatus(p.id, "Approved")}
                          disabled={p.status === "Approved"}
                        >
                          Approve
                        </button>
                        <button
                          className="btn-reject"
                          onClick={() => updateStatus(p.id, "Rejected")}
                          disabled={p.status === "Rejected"}
                        >
                          Reject
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {tab === "users" && (
          <div className="users-section">
            <form className="create-user-form" onSubmit={createUser}>
              <h3>Create User</h3>
              <div className="create-user-fields">
                <input
                  placeholder="Username"
                  value={newUser.username}
                  onChange={(e) => setNewUser((p) => ({ ...p, username: e.target.value }))}
                  required
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={newUser.email}
                  onChange={(e) => setNewUser((p) => ({ ...p, email: e.target.value }))}
                  required
                />
                <input
                  type="password"
                  placeholder="Password (min 8 chars)"
                  value={newUser.password}
                  onChange={(e) => setNewUser((p) => ({ ...p, password: e.target.value }))}
                  required
                />
                <select
                  value={newUser.type}
                  onChange={(e) => setNewUser((p) => ({ ...p, type: e.target.value }))}
                >
                  <option value="player">Player</option>
                  <option value="photographer">Photographer</option>
                  <option value="admin">Admin</option>
                </select>
                <button type="submit" className="btn-create">Create</button>
              </div>
              {userMsg && (
                <p className={`user-msg ${userMsg.ok ? "ok" : "err"}`}>{userMsg.text}</p>
              )}
            </form>

            {usersLoading ? <p className="admin-loading">Loading…</p> : (
              <div className="table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Username</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id}>
                        <td>{u.id}</td>
                        <td>{u.username}</td>
                        <td>{u.email}</td>
                        <td>
                          <span className={`badge badge-role-${u.type}`}>{u.type}</span>
                        </td>
                        <td>
                          <button className="btn-delete" onClick={() => deleteUser(u.id)}>
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
