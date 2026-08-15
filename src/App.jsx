import { Routes, Route } from 'react-router-dom'
import { CatalogProvider } from './store/CatalogContext.jsx'
import Home from './pages/Home.jsx'
import Detail from './pages/Detail.jsx'
import CategoryPage from './pages/CategoryPage.jsx'
import MoviesPage from './pages/MoviesPage.jsx'
import SeriesPage from './pages/SeriesPage.jsx'
import SeriesDetail from './pages/SeriesDetail.jsx'
import AnimePage from './pages/AnimePage.jsx'
import AnimeDetail from './pages/AnimeDetail.jsx'
import Navbar from './components/Navbar.jsx'
import ApiStatusBanner from './components/ApiStatusBanner.jsx'

export default function App() {
  return (
    <CatalogProvider>
      <div className="app">
        <Navbar />
        <ApiStatusBanner />
        <main>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/movie/:slug" element={<Detail />} />
            <Route path="/movies" element={<MoviesPage />} />
            <Route path="/categoria/:genre" element={<CategoryPage />} />
            <Route path="/series" element={<SeriesPage />} />
            <Route path="/serie/:slug" element={<SeriesDetail />} />
            <Route path="/anime" element={<AnimePage />} />
            <Route path="/anime/:slug" element={<AnimeDetail />} />
          </Routes>
        </main>
      </div>
    </CatalogProvider>
  )
}
