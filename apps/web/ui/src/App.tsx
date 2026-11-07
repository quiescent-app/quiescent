import { Navigate, Route, Routes } from "react-router-dom";

import AppLayout from "@/layout";
// import LibraryPage from "@/pages/LibraryPage";
// import AccountPage from "@/pages/AccountPage";

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/library" element={<div></div>} />
        <Route path="/account" element={<div></div>} />
        <Route path="/setting" element={<div></div>} />
      </Route>

      <Route path="/" element={<Navigate to="/library" replace />} />
      <Route path="*" element={<Navigate to="/library" replace />} />
    </Routes>
  );
}
