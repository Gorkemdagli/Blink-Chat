import { Shield, Users, FileText, Download, ArrowRight, Moon, Sun, Zap, Laptop } from 'lucide-react'
import ChatInterfacePreview from './ChatInterfacePreview'

interface LandingPageProps {
    onStart: () => void
    onShowFeatures: () => void
    onShowAbout: () => void
    darkMode: boolean
    onToggleDarkMode: () => void
}

export default function LandingPage({ onStart, onShowFeatures, onShowAbout, darkMode, onToggleDarkMode }: LandingPageProps) {
    return (
        <div className="min-h-[100dvh] w-full overflow-x-hidden bg-white dark:bg-slate-900 text-slate-900 dark:text-white transition-colors selection:bg-blue-100 selection:text-blue-600">
            {/* Navigation */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-100 dark:border-slate-800 transition-colors">
                <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 md:h-20 flex items-center justify-between">
                    <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo(0, 0)}>
                        <img src="/favicon-active.svg" alt="Blink Logo" className="w-8 h-8 md:w-10 md:h-10" />
                        <span className="text-xl md:text-2xl font-black tracking-tight text-slate-900 dark:text-white">Blink</span>
                    </div>
                    <div className="hidden md:flex items-center gap-10">
                        <button onClick={onShowFeatures} className="text-sm font-semibold text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Özellikler</button>
                        <button onClick={onShowAbout} className="text-sm font-semibold text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Hakkımızda</button>
                    </div>
                    <div className="flex items-center gap-2 md:gap-4">
                        <button
                            onClick={onToggleDarkMode}
                            className="p-2 md:p-3 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all"
                            title={darkMode ? "Açık Mod" : "Koyu Mod"}
                        >
                            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
                        </button>
                        <button
                            onClick={onStart}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 md:px-6 py-2 md:py-3 rounded-full font-bold text-xs md:text-sm transition-all shadow-lg shadow-blue-100 dark:shadow-none hover:shadow-blue-200 active:scale-95"
                        >
                            Hemen Başla
                        </button>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="pt-28 md:pt-40 pb-16 md:pb-20 px-4 md:px-6 relative overflow-hidden">
                <div className="absolute -top-20 -right-20 w-64 md:w-96 h-64 md:h-96 bg-blue-50 dark:bg-blue-900/10 rounded-full blur-3xl opacity-50 -z-10"></div>
                <div className="absolute top-1/2 -left-20 w-48 md:w-64 h-48 md:h-64 bg-indigo-50 dark:bg-indigo-900/10 rounded-full blur-3xl opacity-50 -z-10"></div>

                <div className="max-w-7xl mx-auto flex flex-col items-center text-center">
                    <div className="inline-flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-3 md:px-4 py-1.5 md:py-2 rounded-full mb-6 md:mb-8 border border-blue-100 dark:border-blue-900/30">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                        </span>
                        <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider">Açık Kaynak Proje</span>
                    </div>

                    <h1 className="text-4xl sm:text-6xl md:text-8xl font-black text-slate-900 dark:text-white leading-tight mb-6 md:mb-8 tracking-tighter">
                        Gerçek zamanlı sohbet. <br className="hidden sm:block" />
                        <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Gereksiz hiçbir şey olmadan.</span>
                    </h1>

                    <p className="max-w-2xl text-base md:text-xl text-slate-500 dark:text-slate-400 mb-8 md:mb-12 font-medium leading-relaxed">
                        Basit. Anlık. Güvenli. Modern iletişim karmaşık olmak zorunda değil.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center gap-3 md:gap-4 mb-12 md:mb-16 w-full sm:w-auto">
                        <button
                            onClick={onStart}
                            className="w-full sm:w-auto group flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 md:px-10 py-4 md:py-5 rounded-2xl font-bold text-base md:text-lg transition-all shadow-xl shadow-blue-100 dark:shadow-none hover:-translate-y-1"
                        >
                            Hemen Başla <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </button>
                        <button className="w-full sm:w-auto flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-8 md:px-10 py-4 md:py-5 rounded-2xl font-bold text-base md:text-lg transition-all">
                            <Download className="w-5 h-5" /> Uygulamayı İndir
                        </button>
                    </div>

                    <div className="flex items-center gap-3 md:gap-4 p-3 md:p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-2xl text-xs md:text-sm font-bold text-slate-500 dark:text-slate-400">
                        <span>WebSocket</span>
                        <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600"></span>
                        <span>Supabase</span>
                        <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600"></span>
                        <span>React</span>
                        <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600"></span>
                        <span>Node.js</span>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section className="py-16 md:py-32 px-4 md:px-6 bg-slate-50/50 dark:bg-slate-900/20 transition-colors">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-12 md:mb-20">
                        <h2 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white mb-4 md:mb-6 tracking-tight">
                            Gereksiz özellik yok.<br className="hidden sm:block" /> Sadece ihtiyacınız olanlar.
                        </h2>
                    </div>

                    <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6 md:gap-8 mb-12">
                        <FeatureCard
                            icon={<Zap className="w-6 h-6 md:w-8 md:h-8 text-blue-600 dark:text-blue-400" />}
                            title="Gerçek Zamanlı Hız"
                            description="Mesaj gönderdiğiniz anda karşı tarafa ulaşır. Bekleme yok."
                        />
                        <FeatureCard
                            icon={<Users className="w-6 h-6 md:w-8 md:h-8 text-blue-600 dark:text-blue-400" />}
                            title="Grup Sohbetleri"
                            description="İstediğiniz kadar üye ile organize olun. Sınır yok."
                        />
                        <FeatureCard
                            icon={<FileText className="w-6 h-6 md:w-8 md:h-8 text-blue-600 dark:text-blue-400" />}
                            title="Dosya Paylaşımı"
                            description="Sürükle, bırak, gönder. Bu kadar basit."
                        />
                        <FeatureCard
                            icon={<Shield className="w-6 h-6 md:w-8 md:h-8 text-blue-600 dark:text-blue-400" />}
                            title="Veri Güvenliği"
                            description="Row Level Security ile her kullanıcı sadece kendi verisini görür."
                        />
                        <FeatureCard
                            icon={<Laptop className="w-6 h-6 md:w-8 md:h-8 text-blue-600 dark:text-blue-400" />}
                            title="Her Cihazda Kusursuz"
                            description="Telefon, tablet veya masaüstü. Responsive tasarım ile her yerde aynı deneyim."
                        />
                        <FeatureCard
                            icon={<Moon className="w-6 h-6 md:w-8 md:h-8 text-blue-600 dark:text-blue-400" />}
                            title="Dinamik Temalar"
                            description="Açık ve koyu mod arasında tek tıkla geçiş yapın."
                        />
                    </div>

                    <div className="text-center">
                        <button
                            onClick={onStart}
                            className="inline-flex items-center gap-2  bg-blue-600 border border-slate-700 hover:bg-slate-800  dark:hover:bg-gray-100 text-white px-8 md:px-10 py-4 md:py-5 rounded-2xl font-bold text-base md:text-lg transition-all shadow-xl hover:-translate-y-1"
                        >
                            Uygulamayı Dene
                            <ArrowRight className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </section>

            {/* App Preview Section */}
            <section className="py-16 md:py-32 px-4 md:px-6 overflow-hidden">
                <div className="max-w-7xl mx-auto text-center mb-8 md:mb-16">
                    <span className="text-blue-600 dark:text-blue-400 font-bold uppercase tracking-widest text-[10px] md:text-sm mb-2 md:mb-4 block">Canlı Önizleme</span>
                    <h2 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight">Arayüzü Keşfedin</h2>
                </div>

                <ChatInterfacePreview />
            </section>

            {/* Testimonials */}
            <section className="py-16 md:py-32 px-4 md:px-6 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white rounded-t-[40px] md:rounded-t-[100px] transition-colors">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-12 md:mb-20">
                        <h2 className="text-3xl md:text-5xl font-black mb-4 md:mb-6 tracking-tight">Kullanıcılarımız Ne Diyor?</h2>
                    </div>

                    <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6 md:gap-8">
                        <TestimonialCard
                            name="Caner Yılmaz"
                            role="Proje Yöneticisi"
                            content="Ekip içi iletişimimiz hiç bu kadar hızlı olmamıştı. Arayüz çok temiz ve kullanımı inanılmaz kolay."
                        />
                        <TestimonialCard
                            name="Ayşe Kaya"
                            role="Grafik Tasarımcı"
                            content="Dosya paylaşım hızı gerçekten etkileyici. Büyük dosyaları saniyeler içinde müşterilerime gönderebiliyorum."
                        />
                        <TestimonialCard
                            name="Mert Demir"
                            role="Yazılım Geliştirici"
                            content="Karanlık modun göz yormayan tonlarına bayıldım. Kod yazarken yan ekranda sürekli açık."
                        />
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-slate-900 text-slate-400 py-12 md:py-20 px-4 md:px-6 border-t border-slate-800 transition-colors">
                <div className="max-w-7xl mx-auto">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12 mb-12 md:mb-20">
                        <div className="col-span-2 md:col-span-1">
                            <div className="flex items-center gap-2 mb-4 md:mb-6">
                                <img src="/favicon-active.svg" alt="Blink Logo" className="w-6 h-6 md:w-8 md:h-8" />
                                <span className="text-lg md:text-xl font-black text-white">Blink</span>
                            </div>
                            <p className="text-xs md:text-sm leading-relaxed">
                                Hızlı, sade ve güvenli iletişim platformu.
                            </p>
                        </div>

                        <div>
                            <h4 className="text-white font-bold mb-4 md:mb-6 text-sm md:text-base">Ürün</h4>
                            <ul className="space-y-3 md:space-y-4 text-xs md:text-sm font-medium">
                                <li><button onClick={onShowFeatures} className="hover:text-blue-500 transition-colors">Özellikler</button></li>
                                <li><button onClick={onStart} className="hover:text-blue-500 transition-colors">Giriş Yap</button></li>
                                <li><span className="hover:text-blue-500 transition-colors cursor-default">İndir</span></li>
                            </ul>
                        </div>

                        <div>
                            <h4 className="text-white font-bold mb-4 md:mb-6 text-sm md:text-base">Şirket</h4>
                            <ul className="space-y-3 md:space-y-4 text-xs md:text-sm font-medium">
                                <li><button onClick={onShowAbout} className="hover:text-blue-500 transition-colors">Hakkımızda</button></li>
                                <li><span className="hover:text-blue-500 transition-colors cursor-default">Kariyer</span></li>
                                <li><span className="hover:text-blue-500 transition-colors cursor-default">İletişim</span></li>
                            </ul>
                        </div>

                        <div>
                            <h4 className="text-white font-bold mb-4 md:mb-6 text-sm md:text-base">Yasal</h4>
                            <ul className="space-y-3 md:space-y-4 text-xs md:text-sm font-medium">
                                <li><span className="hover:text-blue-500 transition-colors cursor-default">Gizlilik</span></li>
                                <li><span className="hover:text-blue-500 transition-colors cursor-default">Şartlar</span></li>
                            </ul>
                        </div>
                    </div>

                    <div className="pt-8 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between gap-6">
                        <p className="text-[10px] md:text-xs">© 2024 Blink. Tüm hakları saklıdır.</p>
                        <div className="flex items-center gap-6">
                            <span className="hover:text-white transition-colors cursor-pointer"><svg className="w-4 h-4 md:w-5 md:h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg></span>
                            <span className="hover:text-white transition-colors cursor-pointer"><svg className="w-4 h-4 md:w-5 md:h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.84 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" /></svg></span>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    )
}

interface FeatureCardProps {
    icon: React.ReactNode
    title: string
    description: string
}

function FeatureCard({ icon, title, description }: FeatureCardProps) {
    return (
        <div className="bg-white dark:bg-slate-900 p-6 md:p-10 rounded-2xl md:rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-xl hover:-translate-y-2 transition-all duration-300">
            <div className="w-12 h-12 md:w-16 md:h-16 bg-blue-50 dark:bg-blue-900/20 rounded-xl md:rounded-2xl flex items-center justify-center mb-6 md:mb-8 shrink-0">
                {icon}
            </div>
            <h3 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white mb-2 md:mb-4">{title}</h3>
            <p className="text-sm md:text-base text-slate-500 dark:text-slate-400 font-medium leading-relaxed">{description}</p>
        </div>
    )
}

interface TestimonialCardProps {
    name: string
    role: string
    content: string
}

function TestimonialCard({ name, role, content }: TestimonialCardProps) {
    return (
        <div className="bg-white dark:bg-slate-900/80 p-6 md:p-10 rounded-3xl md:rounded-[40px] border border-slate-200 dark:border-slate-800 hover:shadow-xl dark:hover:bg-slate-800 transition-all">
            <div className="flex items-center gap-3 md:gap-4 mb-6 md:mb-8">
                <img src={`https://picsum.photos/100/100?u=${name}`} className="w-12 h-12 md:w-14 md:h-14 rounded-xl md:rounded-2xl object-cover" alt={name} />
                <div>
                    <h4 className="font-bold text-slate-900 dark:text-white text-base md:text-lg">{name}</h4>
                    <p className="text-[10px] md:text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest">{role}</p>
                </div>
            </div>
            <p className="text-sm md:text-base text-slate-600 dark:text-slate-300 italic font-medium leading-relaxed">"{content}"</p>
        </div>
    )
}

