import { useState } from 'react'
import { ArrowLeft, Mail, Lock, User, Eye, EyeOff, Chrome, Github, ShieldCheck } from 'lucide-react'
import { supabase } from '../supabaseClient'

export default function RegisterPage({ onBack, onGoToLogin, onRegister }) {
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        acceptTerms: false
    })

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }))
    }

    const handleRegister = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        if (!formData.acceptTerms) {
            setError('Kullanım şartlarını kabul etmelisiniz')
            setLoading(false)
            return
        }

        try {
            const { data, error: authError } = await supabase.auth.signUp({
                email: formData.email,
                password: formData.password,
                options: {
                    data: {
                        username: formData.firstName || formData.email.split('@')[0],
                        first_name: formData.firstName,
                        last_name: formData.lastName,
                        avatar_url: `https://ui-avatars.com/api/?name=${formData.firstName}+${formData.lastName}`
                    }
                }
            })

            if (authError) {
                setError(authError.message)
                setLoading(false)
                return
            }

            if (!data.session) {
                // Email confirmation gerekli
                alert('Kayıt başarılı! Lütfen e-postanızı kontrol edin ve hesabınızı doğrulayın.')
                onGoToLogin()
            } else {
                // Otomatik login oldu
                onRegister(data.session)
            }
        } catch (err) {
            setError(err.message || 'Kayıt olurken bir hata oluştu')
        } finally {
            setLoading(false)
        }
    }

    const handleGoogleRegister = async () => {
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
            setError(err.message || 'Google ile kayıt olurken bir hata oluştu')
        } finally {
            setLoading(false)
        }
    }

    const handleGithubRegister = async () => {
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
            setError(err.message || 'GitHub ile kayıt olurken bir hata oluştu')
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

            <div className="w-full max-w-[480px] z-10">
                <div className="text-center mb-8">
                    <div className="inline-flex w-16 h-16 bg-blue-600 rounded-2xl items-center justify-center shadow-2xl shadow-blue-200 dark:shadow-none mb-6">
                        <span className="text-white font-black text-3xl">C</span>
                    </div>
                    <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight mb-2">Hesap Oluştur</h1>
                    <p className="text-slate-500 dark:text-gray-400 font-medium">Birkaç saniye içinde topluluğumuza katılın.</p>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[32px] p-8 md:p-10 shadow-2xl shadow-slate-200/50 dark:shadow-none transition-colors">
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 rounded-xl text-red-600 dark:text-red-400 text-sm font-medium">
                            {error}
                        </div>
                    )}

                    <form className="space-y-4" onSubmit={handleRegister}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-gray-300 mb-1.5 ml-1">Adınız</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 dark:text-gray-500 group-focus-within:text-blue-500 dark:group-focus-within:text-sky-500 transition-colors">
                                        <User className="w-4 h-4" />
                                    </div>
                                    <input
                                        type="text"
                                        name="firstName"
                                        value={formData.firstName}
                                        onChange={handleChange}
                                        required
                                        placeholder="Görkem"
                                        className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:bg-white dark:focus:bg-slate-700 focus:ring-4 focus:ring-blue-100 dark:focus:ring-sky-900/20 focus:border-blue-500 dark:focus:border-sky-500 outline-none transition-all font-medium text-slate-800 dark:text-white text-sm"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-gray-300 mb-1.5 ml-1">Soyadınız</label>
                                <input
                                    type="text"
                                    name="lastName"
                                    value={formData.lastName}
                                    onChange={handleChange}
                                    required
                                    placeholder="Yılmaz"
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:bg-white dark:focus:bg-slate-700 focus:ring-4 focus:ring-blue-100 dark:focus:ring-sky-900/20 focus:border-blue-500 dark:focus:border-sky-500 outline-none transition-all font-medium text-slate-800 dark:text-white text-sm"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-gray-300 mb-1.5 ml-1">E-posta Adresi</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 dark:text-gray-500 group-focus-within:text-blue-500 dark:group-focus-within:text-sky-500 transition-colors">
                                    <Mail className="w-4 h-4" />
                                </div>
                                <input
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    required
                                    placeholder="isim@sirket.com"
                                    className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:bg-white dark:focus:bg-slate-700 focus:ring-4 focus:ring-blue-100 dark:focus:ring-sky-900/20 focus:border-blue-500 dark:focus:border-sky-500 outline-none transition-all font-medium text-slate-800 dark:text-white text-sm"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-gray-300 mb-1.5 ml-1">Şifre</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 dark:text-gray-500 group-focus-within:text-blue-500 dark:group-focus-within:text-sky-500 transition-colors">
                                    <Lock className="w-4 h-4" />
                                </div>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    name="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    required
                                    placeholder="••••••••"
                                    className="w-full pl-10 pr-10 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:bg-white dark:focus:bg-slate-700 focus:ring-4 focus:ring-blue-100 dark:focus:ring-sky-900/20 focus:border-blue-500 dark:focus:border-sky-500 outline-none transition-all font-medium text-slate-800 dark:text-white text-sm"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-gray-200 transition-colors"
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        <div className="flex items-start gap-2 py-2">
                            <input
                                type="checkbox"
                                name="acceptTerms"
                                checked={formData.acceptTerms}
                                onChange={handleChange}
                                required
                                className="mt-1 w-4 h-4 rounded border-slate-300 dark:border-slate-600 dark:bg-slate-800 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                            <span className="text-[11px] font-bold text-slate-500 dark:text-gray-400 leading-normal">
                                Kaydolarak <a href="#" className="text-blue-600 dark:text-sky-400 hover:underline">Kullanım Şartları</a> ve <a href="#" className="text-blue-600 dark:text-sky-400 hover:underline">Gizlilik Politikası</a>'nı kabul etmiş olursunuz.
                            </span>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-4 rounded-2xl font-bold text-lg shadow-xl shadow-blue-100 dark:shadow-none transition-all active:scale-[0.98] mt-2 flex items-center justify-center gap-2"
                        >
                            <ShieldCheck className="w-5 h-5" /> {loading ? 'Kayıt yapılıyor...' : 'Kaydı Tamamla'}
                        </button>
                    </form>

                    <div className="relative my-8">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-slate-100 dark:border-slate-800"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-4 bg-white dark:bg-slate-900 text-slate-400 dark:text-gray-500 font-bold uppercase tracking-widest text-[10px]">Veya hızlı kayıt ol</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <button
                            onClick={handleGoogleRegister}
                            disabled={loading}
                            className="flex items-center justify-center gap-2 py-3 px-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-700 font-bold text-slate-700 dark:text-gray-200 transition-all text-sm disabled:opacity-50"
                        >
                            <Chrome className="w-4 h-4 text-red-500" /> Google
                        </button>
                        <button
                            onClick={handleGithubRegister}
                            disabled={loading}
                            className="flex items-center justify-center gap-2 py-3 px-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-700 font-bold text-slate-700 dark:text-gray-200 transition-all text-sm disabled:opacity-50"
                        >
                            <Github className="w-4 h-4 text-slate-900 dark:text-white" /> Github
                        </button>
                    </div>
                </div>

                <p className="text-center mt-8 text-slate-500 dark:text-gray-400 font-medium">
                    Zaten hesabınız var mı? <button onClick={onGoToLogin} className="text-blue-600 dark:text-sky-400 font-bold hover:underline transition-all">Giriş Yapın</button>
                </p>
            </div>
        </div>
    )
}
