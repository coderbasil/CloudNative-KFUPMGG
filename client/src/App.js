import React from "react";
import Landing from "./pages/Landing";
import GamePage from "./pages/GamePage";
import Leaderboard from "./pages/Leaderboard";
import PhotographerPage from "./pages/Photographer";
import Login from "./pages/Login";
import AdminPage from "./pages/Admin";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

const App = () => {
  React.useEffect(() => {
    const preventZoom = (e) => {
      if (e.ctrlKey || e.metaKey) e.preventDefault();
    };
    const preventZoomKeys = (e) => {
      if ((e.ctrlKey || e.metaKey) && ["+", "-", "=", "0"].includes(e.key))
        e.preventDefault();
    };
    document.addEventListener("wheel", preventZoom, { passive: false });
    document.addEventListener("keydown", preventZoomKeys);
    return () => {
      document.removeEventListener("wheel", preventZoom);
      document.removeEventListener("keydown", preventZoomKeys);
    };
  }, []);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/gamepage" element={<GamePage />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/photographer" element={<PhotographerPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </Router>
  );
};

export default App;
