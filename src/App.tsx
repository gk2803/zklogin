import {
  Box,
  Typography,
  Divider,
  Tabs,
  Tab
} from "@mui/material";
import { useNavigate, useLocation, Routes, Route } from "react-router-dom";
import HowItWorksPage from "./HowPage";
import LandPage from "./LandPage";

function App() {
  const navigate = useNavigate();
  const location = useLocation();

  // Determine active tab based on current route
  const tabValue = location.pathname === "/how" ? 1 : 0;

  return (
    <Box sx={{ mb: "36px", mx: "100px" }}>
      {/* Header */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="h5" fontWeight={600} gutterBottom>
          zkLogin
        </Typography>
      </Box>
      {/* Tabs Navigation */}
      <Tabs
        value={tabValue}
        onChange={(_, newValue) => {
          navigate(newValue === 0 ? "/" : "/how");
        }}
        sx={{ mb: 3 }}
      >
        <Tab label="zkLogin Demo" />
        <Tab label="How it works" />
      </Tabs>
      <Divider sx={{ mb: 3 }} />

      {/* Main Content */}
      <Routes>
        <Route path="/" element={<LandPage />} />
        <Route path="/how" element={<HowItWorksPage />} />
      </Routes>
    </Box>
  );
}

// Wrap App with Router in main.tsx, not here
export default App;