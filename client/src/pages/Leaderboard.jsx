import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import "../pages-css/Leaderboard.css";

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

  const podiumName = (rank) => entries[rank - 1]?.player_name ?? "—";

  return (
    <div className="background-page">
      <div className="score">Leaderboard</div>

      <div className="stage">
        <div className="stage-front">Top Players</div>

        <div className="tower third">
          <div className="face front"></div>
          <div className="face right"></div>
          <div className="face top">
            <div className="player">{podiumName(3)}</div>
          </div>
        </div>

        <div className="tower first">
          <div className="face front"></div>
          <div className="face top">
            <div className="player">{podiumName(1)}</div>
          </div>
        </div>

        <div className="tower second">
          <div className="face front"></div>
          <div className="face left"></div>
          <div className="face top">
            <div className="player">{podiumName(2)}</div>
          </div>
        </div>
      </div>

      <div className="lb-panel">
        {loading && <p className="lb-empty">Loading…</p>}
        {!loading && entries.length === 0 && (
          <p className="lb-empty">No scores yet. Be the first!</p>
        )}
        {!loading &&
          entries.map((entry, i) => (
            <div key={i} className={`lb-row${i < 3 ? " lb-top" : ""}`}>
              <span className="lb-rank">#{i + 1}</span>
              <span className="lb-name">{entry.player_name}</span>
              <span className="lb-score">{entry.score} pts</span>
            </div>
          ))}
      </div>

      <button className="start-game-btn" onClick={() => navigate("/gamepage")}>
        Start New Game
      </button>
    </div>
  );
};

export default Leaderboard;
