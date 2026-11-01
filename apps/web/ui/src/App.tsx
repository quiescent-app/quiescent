import { Navigate, Route, Routes } from "react-router-dom";

// import { LibraryPage } from "@/pages/LibraryPage";
// import { AccountPage } from "@/pages/AccountPage";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/library" replace />} />
      <Route path="/library" element={<div>Library</div>} />
      <Route path="/account" element={<div>Account</div>} />
      <Route path="/setting" element={<div>Setting</div>} />
      <Route path="*" element={<Navigate to="/library" replace />} />
    </Routes>
  );
}

export default App;
