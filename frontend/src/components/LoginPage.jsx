import { useState } from 'react'
import { ArrowLeft, Mail, Lock, Eye, EyeOff, Chrome, Github } from 'lucide-react'
import { supabase } from '../supabaseClient'

export default function LoginPage({ onBack, onLogin, onGoToRegister }) {
    const [showPassword, setShowPassword] = useState(false)
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [rememberMe, setRememberMe] = useState(false)

    const handleLogin = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            const { data, error: authError } = await supabase.auth.signInWithPassword({
                email,
                password
            })

            if (authError) {
                setError(authError.message)
                setLoading(false)
                return
            }

            if (data.session) {
                // Remember me özelliği
                if (rememberMe) {
                    localStorage.setItem('rememberMe', 'true')
                } else {
                    localStorage.removeItem('rememberMe')
                }

                onLogin(data.session)
            }
        } catch (err) {
            setError(err.message || 'Giriş yapılırken bir hata oluştu')
        } finally {
            setLoading(false)
        }
    }

    const handleGoogleLogin = async () => {
        setLoading(true)
        try {
            const { error: authError } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: `${window.location.origin}`
                }
            })
            if (authError) {
                setError(authError.message)
            }
        } catch (err) {
            setError(err.message || 'Google ile giriş yapılırken bir hata oluştu')
        } finally {
            setLoading(false)
        }
    }

    const handleGithubLogin = async () => {
        setLoading(true)
        try {
            const { error: authError } = await supabase.auth.signInWithOAuth({
                provider: 'github',
                options: {
                    redirectTo: `${window.location.origin}`
                }
            })
            if (authError) {
                setError(authError.message)
            }
        } catch (err) {
            setError(err.message || 'GitHub ile giriş yapılırken bir hata oluştu')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-white dark:bg-slate-950 flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden transition-colors">
            {/* Background Decorative Elements */}
            <div className="absolute -top-24 -right-24 w-96 h-96 bg-blue-50 dark:bg-blue-900/10 rounded-full blur-3xl opacity-60"></div>
            <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-indigo-50 dark:bg-indigo-900/10 rounded-full blur-3xl opacity-60"></div>

            <button
                onClick={onBack}
                className="absolute top-8 left-8 flex items-center gap-2 text-slate-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-sky-400 font-bold text-sm transition-all group"
            >
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                Anasayfaya Dön
            </button>

            <div className="w-full max-w-[440px] z-10">
                <div className="text-center mb-10">
                    <div className="inline-flex w-16 h-16 bg-blue-600 rounded-2xl items-center justify-center shadow-2xl shadow-blue-200 dark:shadow-none mb-6">
                        <span className="text-white font-black text-3xl">C</span>
                    </div>
                    <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight mb-2">Hoş Geldiniz</h1>
                    <p className="text-slate-500 dark:text-gray-400 font-medium">ChatApp dünyasına giriş yapın ve sohbete başlayın.</p>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[32px] p-8 md:p-10 shadow-2xl shadow-slate-200/50 dark:shadow-none transition-colors">
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 rounded-xl text-red-600 dark:text-red-400 text-sm font-medium">
                            {error}
                        </div>
                    )}

                    <form className="space-y-5" onSubmit={handleLogin}>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-gray-300 mb-2 ml-1">E-posta Adresi</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 dark:text-gray-500 group-focus-within:text-blue-500 dark:group-focus-within:text-sky-400 transition-colors">
                                    <Mail className="w-5 h-5" />
                                </div>
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="isim@sirket.com"
                                    className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:bg-white dark:focus:bg-slate-700 focus:ring-4 focus:ring-blue-100 dark:focus:ring-sky-900/20 focus:border-blue-500 dark:focus:border-sky-500 outline-none transition-all font-medium text-slate-800 dark:text-white"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-gray-300 mb-2 ml-1">Şifre</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 dark:text-gray-500 group-focus-within:text-blue-500 dark:group-focus-within:text-sky-400 transition-colors">
                                    <Lock className="w-5 h-5" />
                                </div>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full pl-12 pr-12 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:bg-white dark:focus:bg-slate-700 focus:ring-4 focus:ring-blue-100 dark:focus:ring-sky-900/20 focus:border-blue-500 dark:focus:border-sky-500 outline-none transition-all font-medium text-slate-800 dark:text-white"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-gray-200 transition-colors"
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center justify-between py-2 text-[13px] md:text-sm">
                            <label className="flex items-center gap-2 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    checked={rememberMe}
                                    onChange={(e) => setRememberMe(e.target.checked)}
                                    className="w-5 h-5 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 dark:bg-slate-800 cursor-pointer"
                                />
                                <span className="font-bold text-slate-500 dark:text-gray-400 group-hover:text-slate-700 dark:group-hover:text-gray-200 transition-colors">Beni Hatırla</span>
                            </label>
                            <a href="#" className="font-bold text-blue-600 dark:text-sky-400 hover:text-blue-700 dark:hover:text-sky-300 transition-colors">Şifremi Unuttum</a>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-4 rounded-2xl font-bold text-lg shadow-xl shadow-blue-100 dark:shadow-none transition-all active:scale-[0.98] mt-2"
                        >
                            {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
                        </button>
                    </form>

                    <div className="relative my-8">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-slate-100 dark:border-slate-800"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-4 bg-white dark:bg-slate-900 text-slate-400 dark:text-gray-500 font-bold uppercase tracking-widest text-[10px]">Veya şununla devam et</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <button
                            onClick={handleGoogleLogin}
                            disabled={loading}
                            className="flex items-center justify-center gap-2 py-3.5 px-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-700 font-bold text-slate-700 dark:text-gray-200 transition-all disabled:opacity-50"
                        >
                            <Chrome className="w-5 h-5 text-red-500" /> Google
                        </button>
                        <button
                            onClick={handleGithubLogin}
                            disabled={loading}
                            className="flex items-center justify-center gap-2 py-3.5 px-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-700 font-bold text-slate-700 dark:text-gray-200 transition-all disabled:opacity-50"
                        >
                            <Github className="w-5 h-5 text-slate-900 dark:text-white" /> Github
                        </button>
                    </div>
                </div>

                <p className="text-center mt-8 text-slate-500 dark:text-gray-400 font-medium">
                    Hesabınız yok mu? <button onClick={onGoToRegister} className="text-blue-600 dark:text-sky-400 font-bold hover:underline transition-all">Ücretsiz Kayıt Olun</button>
                </p>
            </div>
        </div>
    )
}
