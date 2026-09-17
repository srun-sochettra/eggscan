import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import CommitShame from './pages/CommitShame';
import ReadmeRater from './pages/ReadmeRater';
import StackRoast from './pages/StackRoast';

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen">
        <Navbar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/commit-shame" element={<CommitShame />} />
          <Route path="/readme-rater" element={<ReadmeRater />} />
          <Route path="/stack-roast" element={<StackRoast />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}