import React, { useEffect, useLayoutEffect, useState, useRef } from "react";
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

  const dragMovedRef = useRef(false);
  const containerRef = useRef(null);

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

  const handleGuess = () => {
    if (!guessPos) return;

    const dx = guessPos.x - correctPos.x;
    const dy = guessPos.y - correctPos.y;
    const distance = Math.hypot(dx, dy);

    let newScore;

    if (distance <= 20) {
      newScore = 100;
    } else if (distance >= 200) {
      newScore = 0;
    } else {
      newScore = Math.round(100 * (1 - (distance - 20) / 180));
    }

    setRoundScore(newScore);
    setAllScores((prev) => [...prev, newScore]);

    setStage("result");
  };

  const scoreFeedback = (s) => {
    if (s === 100) return "Perfect! Spot on!";
    if (s >= 70) return "Great guess!";
    if (s >= 40) return "Not bad!";
    return "Keep practicing!";
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
              <div
                className="marker"
                style={{
                  left: guessPos.x * scale + offset.x,
                  top: guessPos.y * scale + offset.y,
                }}
              />
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

            <div className="result-score">{avgScore} / 100</div>

            <p className="result-feedback">
              Average score across {allScores.length} round
              {allScores.length !== 1 ? "s" : ""}
            </p>

            <button
              className="g-button play-again-btn"
              onClick={handleFullReset}
            >
              Play Again
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
