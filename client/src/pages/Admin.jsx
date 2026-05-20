import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import "../pages-css/Admin.css";

export default function AdminPage() {
  const navigate = useNavigate();
  const [token, setToken] = useState(null);
  const [tab, setTab] = useState("photos");

  const [photos, setPhotos] = useState([]);
  const [photosLoading, setPhotosLoading] = useState(true);
  const [photosError, setPhotosError] = useState(null);

  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [newUser, setNewUser] = useState({ username: "", email: "", password: "", type: "player" });
  const [userMsg, setUserMsg] = useState(null);

  const [resetting, setResetting] = useState(false);
  const [resetMsg, setResetMsg] = useState(null);

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
    fetch(api("/api/photos"))
      .then((r) => {
        if (!r.ok) throw new Error(`Server error ${r.status}`);
        return r.json();
      })
      .then(setPhotos)
      .catch((err) => setPhotosError(err.message))
      .finally(() => setPhotosLoading(false));
  }, [token]);

  useEffect(() => {
    if (tab !== "users" || !token) return;
    setUsersLoading(true);
    fetch(api("/api/admins"), { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then(setUsers)
      .catch(() => {})
      .finally(() => setUsersLoading(false));
  }, [tab, token]);

  const updateStatus = (id, status) => {
    fetch(api(`/api/photos/${id}/status`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)));
  };

  const deleteUser = (id) => {
    fetch(api(`/api/admins/${id}`), {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    setUsers((prev) => prev.filter((u) => u.id !== id));
  };

  const createUser = async (e) => {
    e.preventDefault();
    setUserMsg(null);
    try {
      const res = await fetch(api("/api/admins"), {
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

  const resetLeaderboard = async () => {
    if (!window.confirm("Reset the entire leaderboard? This cannot be undone.")) return;
    setResetting(true);
    setResetMsg(null);
    try {
      const res = await fetch(api("/api/leaderboard"), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      setResetMsg(res.ok ? { ok: true, text: "Leaderboard cleared." } : { ok: false, text: "Failed to reset." });
    } catch {
      setResetMsg({ ok: false, text: "Network error." });
    } finally {
      setResetting(false);
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
        <button className={`admin-tab ${tab === "leaderboard" ? "active" : ""}`} onClick={() => setTab("leaderboard")}>
          Leaderboard
        </button>
      </div>

      <div className="admin-content">

        {tab === "photos" && (
          photosLoading ? <p className="admin-loading">Loading…</p> :
          photosError ? <p className="admin-loading" style={{ color: "#ff6b7a" }}>Failed to load photos: {photosError}</p> : (
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

        {tab === "leaderboard" && (
          <div className="users-section">
            <h3 style={{ color: "#fff", marginBottom: "1rem" }}>Leaderboard Management</h3>
            <button
              className="btn-delete"
              style={{ padding: "0.6rem 1.5rem", fontSize: "0.95rem" }}
              disabled={resetting}
              onClick={resetLeaderboard}
            >
              {resetting ? "Resetting…" : "Reset Leaderboard"}
            </button>
            {resetMsg && (
              <p className={`user-msg ${resetMsg.ok ? "ok" : "err"}`} style={{ marginTop: "0.75rem" }}>
                {resetMsg.text}
              </p>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
