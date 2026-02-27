import { useState } from 'react'
import { Session } from '@supabase/supabase-js'
import LoginPage from './LoginPage'
import RegisterPage from './RegisterPage'
import LandingPage from './LandingPage'
import FeaturesPage from './FeaturesPage'
import AboutPage from './AboutPage'

interface AuthProps {
    onAuth: (session: Session) => void
    darkMode: boolean
    onToggleDarkMode: () => void
}

export default function Auth({ onAuth, darkMode, onToggleDarkMode }: AuthProps) {
    const [view, setView] = useState<'landing' | 'login' | 'register' | 'features' | 'about'>('landing')

    const handleLogin = (session: Session) => {
        onAuth(session)
    }

    const handleRegister = (session: Session) => {
        onAuth(session)
    }

    return (
        <>
            {view === 'landing' && (
                <LandingPage
                    onStart={() => setView('login')}
                    onShowFeatures={() => setView('features')}
                    onShowAbout={() => setView('about')}
                    darkMode={darkMode}
                    onToggleDarkMode={onToggleDarkMode}
                />
            )}
            {view === 'features' && (
                <FeaturesPage
                    onBack={() => setView('landing')}
                    onStart={() => setView('login')} />
            )}
            {view === 'about' && (
                <AboutPage onBack={() => setView('landing')} />
            )}
            {view === 'login' && (
                <LoginPage
                    onBack={() => setView('landing')}
                    onLogin={handleLogin}
                    onGoToRegister={() => setView('register')}
                />
            )}
            {view === 'register' && (
                <RegisterPage
                    onBack={() => setView('landing')}
                    onGoToLogin={() => setView('login')}
                    onRegister={handleRegister}
                />
            )}
        </>
    )
}
