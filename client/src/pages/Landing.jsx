import "../pages-css/Landing.css";
import React from "react";
import { useNavigate } from "react-router-dom";

const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div className="landing-page">
      <header className="header">
        <button className="photographer-button" onClick={() => navigate("/photographer")}>
          Submit a Photo
        </button>

      </header>
      <div className="content-wrapper">
        <div className="text-block">
          <img
            src="/assets/kfupm-logo.png"
            alt="KFUPM Logo"
            className="kfupm-logo"
          />
          <h1 className="title">KFUPM GeoGuesser</h1>
          <p className="description">
            Test your knowledge of the KFUPM campus by guessing locations
            from images. Can you recognize every spot?
          </p>
          <button className="start-button" onClick={() => navigate("/gamepage")}>
            Start Playing!
          </button>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
