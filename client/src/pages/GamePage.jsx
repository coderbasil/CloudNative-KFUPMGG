import React, {
  useEffect,
  useLayoutEffect,
  useState,
  useRef,
  useCallback,
} from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import "../pages-css/GamePage.css";

export default function GamePage() {
  const navigate = useNavigate();

  const campusMap =
    "https://kfupm-geoguesser.s3.eu-north-1.amazonaws.com/photos/map.png";

  const [photos, setPhotos] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const [photo, setPhoto] = useState(null);
  const [correctPos, setCorrectPos] = useState({ x: 0, y: 0 });

  const [stage, setStage] = useState("view");
  const [guessPos, setGuessPos] = useState(null);

  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setDragging] = useState(false);
  const [lastMouse, setLastMouse] = useState({ x: 0, y: 0 });
  const [startOffset, setStartOffset] = useState({ x: 0, y: 0 });

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [mapNatW, setMapNatW] = useState(0);
  const [mapNatH, setMapNatH] = useState(0);

  const [roundScore, setRoundScore] = useState(0);
  const [allScores, setAllScores] = useState([]);

  const [playerName, setPlayerName] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const dragMovedRef = useRef(false);
  const containerRef = useRef(null);

  // Refs that mirror state so touch handlers (added once) always read fresh values.
  const scaleRef = useRef(scale);
  const offsetRef = useRef(offset);
  const mapNatWRef = useRef(mapNatW);
  const mapNatHRef = useRef(mapNatH);
  const lastTouchRef = useRef(null);
  const lastPinchDistRef = useRef(null);

  scaleRef.current = scale;
  offsetRef.current = offset;
  mapNatWRef.current = mapNatW;
  mapNatHRef.current = mapNatH;

  useEffect(() => {
    const img = new Image();
    img.src = campusMap;
    img.onload = () => {
      setMapNatW(img.naturalWidth);
      setMapNatH(img.naturalHeight);
    };
  }, []);

  const setCurrentPhoto = (photoData) => {
    setPhoto(photoData.url);
    setCorrectPos(photoData.coord);
  };

  const fetchGamePhotos = (signal = undefined) => {
    setIsLoading(true);
    setError(null);

    fetch(api("/api/game/random"), signal ? { signal } : {})
      .then((res) => {
        if (res.status === 404) {
          throw new Error("No photos found");
        }

        if (!res.ok) {
          throw new Error("Server error");
        }

        return res.json();
      })
      .then((data) => {
        if (signal?.aborted) return;

        const gamePhotos = data.photos || [];

        if (!gamePhotos.length) {
          throw new Error("No photos found");
        }

        setPhotos(gamePhotos);
        setCurrentIndex(0);
        setCurrentPhoto(gamePhotos[0]);

        setStage("view");
        setGuessPos(null);
        setRoundScore(0);
        setAllScores([]);
        setPlayerName("");
        setSubmitted(false);
        setSubmitting(false);

        setIsLoading(false);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;

        setError(err.message);
        setIsLoading(false);
      });
  };

  useEffect(() => {
    const ac = new AbortController();
    fetchGamePhotos(ac.signal);

    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    if (stage !== "guess" || !mapNatW || !mapNatH || !containerRef.current) {
      return;
    }

    const { clientWidth: cw, clientHeight: ch } = containerRef.current;

    if (!cw || !ch) return;

    const fit = Math.min(cw / mapNatW, ch / mapNatH);

    setScale(fit);
    setOffset({
      x: (cw - mapNatW * fit) / 2,
      y: (ch - mapNatH * fit) / 2,
    });
  }, [stage, mapNatW, mapNatH]);

  const getFitScale = () => {
    if (!mapNatW || !mapNatH || !containerRef.current) return 1;

    const cw = containerRef.current.clientWidth;
    const ch = containerRef.current.clientHeight;

    return Math.min(cw / mapNatW, ch / mapNatH);
  };

  const handleNextRound = () => {
    const nextIndex = currentIndex + 1;

    if (nextIndex >= photos.length) {
      setStage("final");
      return;
    }

    setCurrentIndex(nextIndex);
    setCurrentPhoto(photos[nextIndex]);

    setGuessPos(null);
    setRoundScore(0);
    setStage("view");
  };

  const handleFullReset = () => {
    setGuessPos(null);
    setStage("view");
    fetchGamePhotos();
  };

  const handleWheel = (e) => {
    e.preventDefault();

    const delta = -e.deltaY * 0.001;
    const newScale = Math.min(5, Math.max(getFitScale(), scale * (1 + delta)));

    const rect = containerRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const newX = mx - (mx - offset.x) * (newScale / scale);
    const newY = my - (my - offset.y) * (newScale / scale);

    setScale(newScale);
    setOffset({ x: newX, y: newY });
  };

  const handleMouseDown = (e) => {
    e.preventDefault();

    dragMovedRef.current = false;
    setDragging(true);
    setLastMouse({ x: e.clientX, y: e.clientY });
    setStartOffset(offset);
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;

    e.preventDefault();
    dragMovedRef.current = true;

    const dx = e.clientX - lastMouse.x;
    const dy = e.clientY - lastMouse.y;

    setOffset({
      x: startOffset.x + dx,
      y: startOffset.y + dy,
    });
  };

  const handleMouseUp = () => {
    setDragging(false);
  };

  const handleMapClick = (e) => {
    if (dragMovedRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();

    const rawX = (e.clientX - rect.left - offset.x) / scale;
    const rawY = (e.clientY - rect.top - offset.y) / scale;

    if (rawX < 0 || rawY < 0 || rawX > mapNatW || rawY > mapNatH) return;

    setGuessPos({
      x: Math.round(rawX),
      y: Math.round(rawY),
    });
  };

  const handleTouchStart = useCallback((e) => {
    e.preventDefault();
    dragMovedRef.current = false;

    if (e.touches.length === 2) {
      const dx = e.touches[1].clientX - e.touches[0].clientX;
      const dy = e.touches[1].clientY - e.touches[0].clientY;
      lastPinchDistRef.current = Math.hypot(dx, dy);
      lastTouchRef.current = null;
    } else if (e.touches.length === 1) {
      lastTouchRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      };
      lastPinchDistRef.current = null;
    }
  }, []);

  const handleTouchMove = useCallback((e) => {
    e.preventDefault();

    if (e.touches.length === 2 && lastPinchDistRef.current !== null) {
      dragMovedRef.current = true;
      const t0 = e.touches[0];
      const t1 = e.touches[1];
      const newDist = Math.hypot(
        t1.clientX - t0.clientX,
        t1.clientY - t0.clientY,
      );
      const ratio = newDist / lastPinchDistRef.current;
      lastPinchDistRef.current = newDist;

      const rect = containerRef.current.getBoundingClientRect();
      const mx = (t0.clientX + t1.clientX) / 2 - rect.left;
      const my = (t0.clientY + t1.clientY) / 2 - rect.top;

      const prevScale = scaleRef.current;
      const prevOffset = offsetRef.current;
      const natW = mapNatWRef.current;
      const natH = mapNatHRef.current;
      const fitScale =
        natW && natH
          ? Math.min(
              containerRef.current.clientWidth / natW,
              containerRef.current.clientHeight / natH,
            )
          : 1;
      const newScale = Math.min(5, Math.max(fitScale, prevScale * ratio));

      setScale(newScale);
      setOffset({
        x: mx - (mx - prevOffset.x) * (newScale / prevScale),
        y: my - (my - prevOffset.y) * (newScale / prevScale),
      });
    } else if (e.touches.length === 1 && lastTouchRef.current) {
      dragMovedRef.current = true;
      const dx = e.touches[0].clientX - lastTouchRef.current.x;
      const dy = e.touches[0].clientY - lastTouchRef.current.y;
      lastTouchRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      };
      const prev = offsetRef.current;
      setOffset({ x: prev.x + dx, y: prev.y + dy });
    }
  }, []);

  const handleTouchEnd = useCallback((e) => {
    e.preventDefault();

    if (e.touches.length < 2) lastPinchDistRef.current = null;

    if (e.touches.length === 0) {
      if (!dragMovedRef.current && e.changedTouches.length === 1) {
        const touch = e.changedTouches[0];
        const rect = containerRef.current.getBoundingClientRect();
        const rawX =
          (touch.clientX - rect.left - offsetRef.current.x) / scaleRef.current;
        const rawY =
          (touch.clientY - rect.top - offsetRef.current.y) / scaleRef.current;
        if (
          rawX >= 0 &&
          rawY >= 0 &&
          rawX <= mapNatWRef.current &&
          rawY <= mapNatHRef.current
        ) {
          setGuessPos({ x: Math.round(rawX), y: Math.round(rawY) });
        }
      }
      lastTouchRef.current = null;
    } else if (e.touches.length === 1) {
      lastTouchRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      };
    }
  }, []);

  useEffect(() => {
    if (stage !== "guess") return;
    const el = containerRef.current;
    if (!el) return;

    el.addEventListener("touchstart", handleTouchStart, { passive: false });
    el.addEventListener("touchmove", handleTouchMove, { passive: false });
    el.addEventListener("touchend", handleTouchEnd, { passive: false });

    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", handleTouchEnd);
    };
  }, [stage, handleTouchStart, handleTouchMove, handleTouchEnd]);

  const handleGuess = () => {
    if (!guessPos) return;

    const dx = guessPos.x - correctPos.x;
    const dy = guessPos.y - correctPos.y;
    const distance = Math.hypot(dx, dy);

    let newScore;

    if (distance <= 50) {
      newScore = 100;
    } else if (distance >= 500) {
      newScore = 0;
    } else {
      newScore = Math.round(100 * Math.pow(1 - (distance - 50) / 450, 1.2));
    }

    setRoundScore(newScore);
    setAllScores((prev) => [...prev, newScore]);

    setStage("result");
  };

  const handleSubmitScore = async () => {
    if (!playerName.trim() || submitting) return;
    setSubmitting(true);
    setSubmitError("");
    const totalScore = allScores.reduce((a, b) => a + b, 0);
    try {
      const res = await fetch(api("/api/leaderboard"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          player_name: playerName.trim(),
          score: totalScore,
          rounds: allScores.length,
        }),
      });
      if (res.ok) {
        setSubmitted(true);
      } else {
        const body = await res.json().catch(() => ({}));
        setSubmitError(body.error || `Server error ${res.status}`);
      }
    } catch (err) {
      setSubmitError("Network error — could not reach server");
    } finally {
      setSubmitting(false);
    }
  };

  const scoreFeedback = (s) => {
    if (s === 100) return "Perfect! Spot on!";
    if (s >= 70) return "Great guess!";
    if (s >= 40) return "Not bad!";
    return "Keep practicing!";
  };

  const finalFeedback = (total, maxTotal) => {
    const pct = total / maxTotal;
    if (pct === 1) return "🏆 شكلك حافظ أماكن الأفياش والمكيفات بعد";
    if (pct >= 0.5) return "👀 شيبه بس باقي ما شفت كل شي";
    if (pct >= 0.1) return "😂 يا اوريااااااااااااا";
    return "💀 أنت متأكد إنك تدرس في الجامعة هذي؟";
  };

  if (isLoading) {
    return (
      <div className="game-page loading">
        <div className="spinner" />
        <p className="loading-text">Loading photos…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="game-page loading">
        <p className="loading-text">{error}</p>
        <button className="g-button" onClick={() => navigate("/")}>
          Back to Home
        </button>
      </div>
    );
  }

  const totalPhotos = photos.length;
  const roundNum = currentIndex + 1;
  const photosLeft = totalPhotos - roundNum;

  const avgScore =
    allScores.length > 0
      ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
      : 0;

  return (
    <div className="game-page">
      {stage === "view" && (
        <div className="view-stage">
          {totalPhotos > 0 && (
            <p className="round-counter">
              Round {roundNum} of {totalPhotos}
            </p>
          )}

          <p className="stage-hint">Where on campus was this photo taken?</p>

          <div className="photo-frame">
            <img src={photo} alt="Guess this location" />
          </div>

          <button className="g-button" onClick={() => setStage("guess")}>
            Make a Guess
          </button>
        </div>
      )}

      {stage === "guess" && (
        <div className="guess-stage">
          {totalPhotos > 0 && (
            <p className="round-counter">
              Round {roundNum} of {totalPhotos}
            </p>
          )}

          <div
            className={`map-frame ${isDragging ? "dragging" : ""}`}
            ref={containerRef}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <img
              src={campusMap}
              alt="Campus Map"
              className="map-image"
              style={{
                width: mapNatW || "auto",
                height: mapNatH || "auto",
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                transformOrigin: "top left",
              }}
              draggable={false}
            />

            <div className="map-click-layer" onClick={handleMapClick} />

            {guessPos && (
              <svg
                className="marker"
                width="48"
                height="72"
                viewBox="0 0 24 36"
                style={{
                  left: guessPos.x * scale + offset.x,
                  top: guessPos.y * scale + offset.y,
                }}
                xmlns="http://www.w3.org/2000/svg"
              >
                <defs>
                  <filter id="pin-shadow" x="-30%" y="-10%" width="160%" height="140%">
                    <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" floodOpacity="0.5" />
                  </filter>
                </defs>
                <path
                  d="M12 0C5.373 0 0 5.373 0 12c0 9 12 24 12 24s12-15 12-24C24 5.373 18.627 0 12 0z"
                  fill="#e74c3c"
                  stroke="white"
                  strokeWidth="1"
                  filter="url(#pin-shadow)"
                />
                <circle cx="12" cy="11" r="4" fill="white" />
              </svg>
            )}
          </div>

          <div className="guess-actions">
            <button
              className="g-button g-secondary"
              onClick={() => setStage("view")}
            >
              ← Back to Photo
            </button>

            <button
              className="g-button"
              disabled={!guessPos}
              onClick={handleGuess}
            >
              Submit Guess
            </button>
          </div>
        </div>
      )}

      {stage === "result" && (
        <div className="result-stage">
          <img src={photo} className="background-img" alt="Location" />

          <div className="result-card">
            <h2 className="result-title">Round {roundNum} Score</h2>

            <div className="result-score">{roundScore} / 100</div>

            <p className="result-feedback">{scoreFeedback(roundScore)}</p>

            <p className="result-remaining">
              {photosLeft} photo{photosLeft !== 1 ? "s" : ""} left
            </p>

            {photosLeft > 0 ? (
              <button
                className="g-button play-again-btn"
                onClick={handleNextRound}
              >
                Next Round
              </button>
            ) : (
              <button
                className="g-button play-again-btn"
                onClick={() => setStage("final")}
              >
                See Final Score
              </button>
            )}

            <button
              className="g-button end-game-btn"
              onClick={() => setStage("final")}
            >
              End Game
            </button>

            <button className="g-button home-btn" onClick={() => navigate("/")}>
              Home
            </button>
          </div>
        </div>
      )}

      {stage === "final" && (
        <div className="result-stage">
          <img src={photo} className="background-img" alt="Location" />

          <div className="result-card">
            <h2 className="result-title">Game Complete!</h2>

            <div className="result-score">
              {allScores.reduce((a, b) => a + b, 0)} / {allScores.length * 100}
            </div>

            <p className="result-feedback">
              {allScores.length} round{allScores.length !== 1 ? "s" : ""}{" "}
              &mdash; avg {avgScore} / 100
            </p>

            <p className="result-feedback-final">
              {finalFeedback(
                allScores.reduce((a, b) => a + b, 0),
                allScores.length * 100,
              )}
            </p>

            {!submitted ? (
              <div className="name-submit">
                <input
                  className="name-input"
                  type="text"
                  placeholder="Enter your name"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmitScore()}
                  maxLength={30}
                />
                <button
                  className="g-button"
                  style={{ width: "100%", marginTop: "0.5rem" }}
                  disabled={!playerName.trim() || submitting}
                  onClick={handleSubmitScore}
                >
                  {submitting ? "Saving…" : "Save to Leaderboard"}
                </button>
                {submitError && (
                  <p
                    style={{
                      color: "#ff6b6b",
                      fontSize: "0.8rem",
                      marginTop: "0.4rem",
                      textAlign: "center",
                    }}
                  >
                    {submitError}
                  </p>
                )}
              </div>
            ) : (
              <p className="saved-msg">Score saved!</p>
            )}

            <button
              className="g-button play-again-btn"
              onClick={handleFullReset}
            >
              Play Again
            </button>

            <button
              className="g-button home-btn"
              style={{ marginTop: "0.5rem" }}
              onClick={() => navigate("/leaderboard")}
            >
              View Leaderboard
            </button>

            <button className="g-button home-btn" onClick={() => navigate("/")}>
              Home
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
