import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import "../pages-css/Leaderboard.css";

const MEDALS = ["🥇", "🥈", "🥉"];

const Leaderboard = () => {
  const navigate = useNavigate();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(api("/api/leaderboard"))
      .then((r) => r.json())
      .then((data) => {
        setEntries(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="lb-page">
      <div className="lb-card">
        <h1 className="lb-title">Leaderboard</h1>

        {loading && <p className="lb-empty">Loading…</p>}

        {!loading && entries.length === 0 && (
          <p className="lb-empty">No scores yet. Be the first!</p>
        )}

        {!loading && entries.length > 0 && (
          <ol className="lb-list">
            {entries.map((entry, i) => (
              <li key={i} className={`lb-row rank-${i + 1}`}>
                <span className="lb-rank">
                  {i < 3 ? MEDALS[i] : `#${i + 1}`}
                </span>
                <span className="lb-name">{entry.player_name}</span>
                <span className="lb-score">{entry.score} pts</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <button className="lb-btn" onClick={() => navigate("/gamepage")}>
        Start New Game
      </button>
    </div>
  );
};

export default Leaderboard;
