import { useState } from 'react'
import LoginPage from './LoginPage'
import RegisterPage from './RegisterPage'
import LandingPage from './LandingPage'
import FeaturesPage from './FeaturesPage'

export default function Auth({ onAuth, darkMode, onToggleDarkMode }) {
    const [view, setView] = useState('landing') // 'landing', 'login', 'register', 'features'

    const handleLogin = (session) => {
        onAuth(session)
    }

    const handleRegister = (session) => {
        onAuth(session)
    }

    return (
        <>
            {view === 'landing' && (
                <LandingPage
                    onStart={() => setView('login')}
                    onShowFeatures={() => setView('features')}
                    darkMode={darkMode}
                    onToggleDarkMode={onToggleDarkMode}
                />
            )}
            {view === 'features' && (
                <FeaturesPage onBack={() => setView('landing')} darkMode={darkMode} />
            )}
            {view === 'login' && (
                <LoginPage
                    onBack={() => setView('landing')}
                    onLogin={handleLogin}
                    onGoToRegister={() => setView('register')}
                    darkMode={darkMode}
                />
            )}
            {view === 'register' && (
                <RegisterPage
                    onBack={() => setView('landing')}
                    onGoToLogin={() => setView('login')}
                    onRegister={handleRegister}
                    darkMode={darkMode}
                />
            )}
        </>
    )
}
