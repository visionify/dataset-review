import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import ConfigPage from "./pages/ConfigPage";
import SettingsPage from "./pages/SettingsPage";
import ClassesPage from "./pages/ClassesPage";
import ClassDetailPage from "./pages/ClassDetailPage";
import ImageDetailPage from "./pages/ImageDetailPage";
import ValidationPage from "./pages/ValidationPage";
import ImagesPage from "./pages/ImagesPage";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<ClassesPage />} />
        <Route path="/config" element={<ConfigPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/class/:classId" element={<ClassDetailPage />} />
        <Route path="/image/:split/:name" element={<ImageDetailPage />} />
        <Route path="/validation" element={<ValidationPage />} />
        <Route path="/all-images" element={<Navigate to="/images/all" replace />} />
        <Route path="/images" element={<Navigate to="/images/all" replace />} />
        <Route path="/images/:split" element={<ImagesPage />} />
      </Routes>
    </Layout>
  );
}
