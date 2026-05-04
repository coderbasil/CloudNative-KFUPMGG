import React, { useRef, useState, useEffect, useLayoutEffect } from "react";
import { api } from "../api";
import "../pages-css/Photographer.css";

const PhotographerPage = () => {
  const campusMap =
    "https://kfupm-geoguesser.s3.eu-north-1.amazonaws.com/photos/map.png";

  const [showMapModal, setShowMapModal] = useState(false);
  const [formData, setFormData] = useState({
    photo: null,
    difficulty: "Easy",
    locationName: "",
    coordinates: null,
  });
  const [submitStatus, setSubmitStatus] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(true);

  const userEmail = (() => {
    try {
      const stored = JSON.parse(localStorage.getItem("kfupm_user"))?.email;
      if (stored) return stored;
    } catch { /* ignore */ }
    // Fallback: generate a persistent anonymous ID so submissions are still trackable
    let anonId = localStorage.getItem("kfupm_anon_id");
    if (!anonId) {
      anonId = "anon-" + Math.random().toString(36).slice(2, 10);
      localStorage.setItem("kfupm_anon_id", anonId);
    }
    return anonId;
  })();

  useEffect(() => {
    fetch(api("/api/photos"))
      .then((res) => res.json())
      .then((data) => {
        const myPhotos = userEmail
          ? data.filter((p) => p.photographer === userEmail)
          : data;
        setSubmissions(myPhotos);
      })
      .catch(() => {})
      .finally(() => setSubmissionsLoading(false));
  }, [userEmail]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.photo) {
      setSubmitStatus({ ok: false, message: "Please select a photo to upload." });
      return;
    }
    if (!formData.coordinates) {
      setSubmitStatus({ ok: false, message: "Please select a location on the map." });
      return;
    }

    try {
      // Step 1: get presigned S3 URL and save DB record
      const presignRes = await fetch(api("/api/upload/presign"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: formData.photo.name,
          contentType: formData.photo.type || "image/jpeg",
          difficulty: formData.difficulty,
          locationName: formData.locationName,
          x: formData.coordinates.x,
          y: formData.coordinates.y,
          photographer: userEmail,
        }),
      });
      const presignData = await presignRes.json();
      if (!presignRes.ok) throw new Error(presignData.error || "Failed to get upload URL");

      // Step 2: upload directly to S3
      const s3Res = await fetch(presignData.uploadUrl, {
        method: "PUT",
        body: formData.photo,
        headers: { "Content-Type": formData.photo.type || "image/jpeg" },
      });
      if (!s3Res.ok) throw new Error("Upload to S3 failed");

      setSubmitStatus({ ok: true, message: "Photo submitted successfully!" });
      setFormData({ photo: null, difficulty: "Easy", locationName: "", coordinates: null });
      setSubmissions((prev) => [presignData.photo, ...prev]);
    } catch (err) {
      setSubmitStatus({ ok: false, message: err.message });
    }
  };

  useEffect(() => {
    const originalOverflow = document.body.style.overflow || "";
    document.body.style.overflow = showMapModal ? "hidden" : originalOverflow;
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [showMapModal]);

  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setDragging] = useState(false);
  const dragMovedRef = useRef(false);
  const [imageDimensions, setImageDimensions] = useState({
    width: 0,
    height: 0,
  });
  const containerRef = useRef(null);

  useLayoutEffect(() => {
    if (!showMapModal || !imageDimensions.width || !imageDimensions.height || !containerRef.current)
      return;
    const { clientWidth: cw, clientHeight: ch } = containerRef.current;
    if (!cw || !ch) return;
    const fit = Math.min(cw / imageDimensions.width, ch / imageDimensions.height);
    setScale(fit);
    setOffset({ x: (cw - imageDimensions.width * fit) / 2, y: (ch - imageDimensions.height * fit) / 2 });
  }, [showMapModal, imageDimensions]);

  useEffect(() => {
    const img = new Image();
    img.src = campusMap;
    img.onload = () =>
      setImageDimensions({
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
  }, [campusMap]);

  const handleInputChange = (e) => {
    const { name, value, files } = e.target;
    setFormData((fd) => ({ ...fd, [name]: files ? files[0] : value }));
  };

  const getFitScale = () => {
    if (!imageDimensions.width || !imageDimensions.height || !containerRef.current) return 0.1;
    const { clientWidth: cw, clientHeight: ch } = containerRef.current;
    return Math.min(cw / imageDimensions.width, ch / imageDimensions.height);
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.001;
    const newScale = Math.min(3, Math.max(getFitScale(), scale * (1 + delta)));
    const rect = containerRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left,
      my = e.clientY - rect.top;
    setScale(newScale);
    setOffset({
      x: mx - (mx - offset.x) * (newScale / scale),
      y: my - (my - offset.y) * (newScale / scale),
    });
  };

  const handleMouseDown = (e) => {
    e.preventDefault();
    dragMovedRef.current = false;
    setDragging(true);
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    e.preventDefault();
    dragMovedRef.current = true;
    setOffset((o) => ({ x: o.x + e.movementX, y: o.y + e.movementY }));
  };

  const handleMouseUp = () => setDragging(false);

  const handleMapClick = (e) => {
    if (dragMovedRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const rawX = (e.clientX - rect.left - offset.x) / scale;
    const rawY = (e.clientY - rect.top - offset.y) / scale;
    setFormData((fd) => ({ ...fd, coordinates: { x: rawX, y: rawY } }));
  };

  const statusClass = (status) => {
    if (status === "Approved") return "status-approved";
    if (status === "Rejected") return "status-rejected";
    return "status-pending";
  };

  return (
    <div className="photographer-page">
      <header className="photographer-header">
        <div className="header-center">
          <img
            src="/assets/kfupm-logo.png"
            alt="KFUPM Logo"
            className="kfupm-logo"
          />
          <h1 className="welcome-text">Welcome Photographer!</h1>
        </div>
      </header>

      <div className="photographer-content">
        <div className="upload-container">
          <h2 className="section-title">Upload New Photo</h2>
          <form className="upload-form" onSubmit={handleSubmit}>
            <div className="file-upload-group">
              <input
                type="file"
                name="photo"
                accept="image/*"
                className="file-input"
                onChange={handleInputChange}
              />
              <span className="upload-label">
                {formData.photo?.name || "Click to Upload Photo"}
              </span>
            </div>

            <div className="form-group">
              <label className="input-label">Difficulty</label>
              <select
                name="difficulty"
                className="form-input"
                value={formData.difficulty}
                onChange={handleInputChange}
              >
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </select>
            </div>

            <div className="form-group">
              <label className="input-label">Location Name</label>
              <input
                type="text"
                name="locationName"
                className="form-input"
                value={formData.locationName}
                onChange={handleInputChange}
                placeholder="Enter location name"
              />
            </div>

            <div className="form-group">
              <button
                type="button"
                className="map-button"
                onClick={() => setShowMapModal(true)}
              >
                {formData.coordinates
                  ? "Change Map Location"
                  : "Select Map Location"}
              </button>
              {formData.coordinates && (
                <div className="coordinates-display">
                  Selected: X {Math.round(formData.coordinates.x)}, Y{" "}
                  {Math.round(formData.coordinates.y)}
                </div>
              )}
            </div>

            {submitStatus && (
              <p
                className={submitStatus.ok ? "submit-success" : "submit-error"}
              >
                {submitStatus.message}
              </p>
            )}

            <button type="submit" className="submit-button">
              Submit Photo
            </button>
          </form>
        </div>

        <div className="submissions-container">
          <h2 className="section-title">My Submissions</h2>
          <div className="photo-table">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Location</th>
                  <th>Difficulty</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {submissionsLoading ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: "center" }}>
                      Loading…
                    </td>
                  </tr>
                ) : submissions.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: "center" }}>
                      No submissions yet
                    </td>
                  </tr>
                ) : (
                  submissions.map((s) => (
                    <tr key={s.id}>
                      <td>{s.id}</td>
                      <td>{s.location_name || s.locationN || "—"}</td>
                      <td>{s.diff || "—"}</td>
                      <td className={statusClass(s.status)}>{s.status}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showMapModal && (
        <div className="map-modal">
          <div className="map-modal-content">
            <h2>Select Location on Map</h2>
            <div className="map-container-wrapper">
              <div
                className="map-container"
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
                    transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                    transformOrigin: "top left",
                    width: imageDimensions.width,
                    height: imageDimensions.height,
                  }}
                  draggable={false}
                />
                <div
                  className="map-click-layer"
                  onClick={handleMapClick}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    cursor: isDragging ? "grabbing" : "grab",
                  }}
                />
                {formData.coordinates && (
                  <div
                    className="marker"
                    style={{
                      left: formData.coordinates.x * scale + offset.x,
                      top: formData.coordinates.y * scale + offset.y,
                    }}
                  />
                )}
              </div>
            </div>
            <div className="map-modal-actions">
              <button
                className="confirm-btn"
                onClick={() => setShowMapModal(false)}
              >
                Confirm Location
              </button>
              <button
                className="cancel-btn"
                onClick={() => setShowMapModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PhotographerPage;
