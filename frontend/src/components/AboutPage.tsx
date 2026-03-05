import { ArrowLeft, Target, Eye, TrendingUp, CheckCircle, Award } from 'lucide-react'

interface AboutPageProps {
    onBack: () => void
}

export default function AboutPage({ onBack }: AboutPageProps) {
    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto space-y-16">

                {/* Header */}
                <div className="flex items-center gap-4">
                    <button
                        onClick={onBack}
                        className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-600 dark:text-slate-300"
                    >
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                    <div className="flex items-center gap-2 cursor-pointer" onClick={onBack}>
                        <img src="/favicon-active.svg" alt="Blink Logo" className="w-8 h-8 md:w-10 md:h-10" />
                        <span className="text-xl md:text-2xl font-black tracking-tight text-slate-900 dark:text-white">Blink</span>
                    </div>
                </div>

                {/* Hero Section */}
                <div className="text-center max-w-4xl mx-auto space-y-6">
                    <h1 className="text-4xl md:text-6xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
                        İletişimi Yeniden<br />
                        <span className="text-blue-600 dark:text-blue-400">Şekillendiriyoruz</span>
                    </h1>
                    <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                        Modern dünyanın hızlı temposunda, karmaşıklıktan uzak, güçlü ve kusursuz bir iletişim deneyimi sunmak için yola çıktık. Amacımız insanların ve takımların aralarındaki sınırları kaldırmak.
                    </p>
                </div>

                {/* Mission and Vision Grid */}
                <div className="grid md:grid-cols-2 gap-8 lg:gap-12 mt-16">
                    {/* Misyon */}
                    <div className="bg-white dark:bg-slate-900 rounded-[32px] p-8 md:p-12 shadow-xl shadow-slate-100 dark:shadow-none border border-slate-100 dark:border-slate-800 hover:-translate-y-2 transition-all duration-300">
                        <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mb-8">
                            <Target className="w-8 h-8 text-blue-600 flex-shrink-0" />
                        </div>
                        <h3 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white mb-4">Misyonumuz</h3>
                        <p className="text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                            Her büyüklükteki ekibin ve topluluğun güvenli, hızlı ve yenilikçi bir iletişim platformuna erişmesini sağlamak. Güçlü gizlilik standartlarımız ve gelişmiş dosya paylaşım yeteneklerimiz ile iletişimin teknik yükünü sırtlanıp, sizin başarıya odaklanmanızı amaçlıyoruz.
                        </p>
                    </div>

                    {/* Vizyon */}
                    <div className="bg-white dark:bg-slate-900 rounded-[32px] p-8 md:p-12 shadow-xl shadow-slate-100 dark:shadow-none border border-slate-100 dark:border-slate-800 hover:-translate-y-2 transition-all duration-300">
                        <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center mb-8">
                            <Eye className="w-8 h-8 text-indigo-600 flex-shrink-0" />
                        </div>
                        <h3 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white mb-4">Vizyonumuz</h3>
                        <p className="text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                            Yapay zeka asistanları ile harmanlanmış, veri limitlerini ortadan kaldıran ve sektöre yön veren öncü global iletişim standardı olmak. Her bireyin gizliliğinden ödün vermeden en iyi kullanıcı deneyimini yaşaması için arayüzümüzü durmaksızın geliştiriyoruz.
                        </p>
                    </div>
                </div>

                {/* Bizi Öne Çıkaran Avantajlar */}
                <div className="mt-24">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white mb-6">Bizi Öne Çıkaran Avantajlarımız</h2>
                        <div className="w-24 h-1.5 bg-blue-600 rounded-full mx-auto"></div>
                    </div>

                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
                        <AdvantageCard
                            icon={<TrendingUp className="w-6 h-6 text-blue-600" />}
                            title="Yüksek Performans"
                            description="Pürüzsüz animasyonlar ve anlık bildirim sistemiyle optimize edilmiş, gecikmesiz gerçek zamanlı bir motor kullanıyoruz."
                        />
                        <AdvantageCard
                            icon={<Award className="w-6 h-6 text-blue-600" />}
                            title="Ödüllü Minimalist Tasarım"
                            description="UX/UI trendlerine yön veren, kasvetli menülerden uzak, herkesin anında kullanmaya başlayabileceği şık ve sezgisel bir arayüz."
                        />
                        <AdvantageCard
                            icon={<CheckCircle className="w-6 h-6 text-blue-600" />}
                            title="Güvenilirlik (%99.9 Uptime)"
                            description="Güçlü altyapımız ile hiçbir kesinti yaşamadan sohbetinize ve veri transferlerinize dilediğiniz zaman devam edin."
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}

function AdvantageCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
    return (
        <div className="flex gap-4 p-6 bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800">
            <div className="w-12 h-12 shrink-0 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center">
                {icon}
            </div>
            <div>
                <h4 className="font-bold text-lg text-slate-900 dark:text-white mb-2">{title}</h4>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400 leading-relaxed">{description}</p>
            </div>
        </div>
    )
}
