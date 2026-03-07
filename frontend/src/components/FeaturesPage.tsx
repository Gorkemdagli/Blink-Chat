import { Users, FileText, Zap, Lock, MessageSquare, Bell, Search, Globe, Clock, CheckCircle2, ArrowLeft } from 'lucide-react'

interface FeaturesPageProps {
  onBack: () => void
  onStart: () => void
}

export default function FeaturesPage({ onBack, onStart }: FeaturesPageProps) {
  const mainFeatures = [
    {
      icon: <MessageSquare className="w-8 h-8 text-blue-600 dark:text-sky-400" />,
      title: 'Gerçek Zamanlı Mesajlaşma',
      description: 'Mesaj gönderdiğiniz anda karşı tarafa ulaşır. Bekleme yok.',
      highlight: 'Anlık'
    },
    {
      icon: <Users className="w-8 h-8 text-blue-600 dark:text-sky-400" />,
      title: 'Sınırsız Grup Sohbetleri',
      description: 'İstediğiniz kadar üye ile organize olun. Sınır yok.',
      highlight: 'Sınırsız'
    },
    {
      icon: <Lock className="w-8 h-8 text-blue-600 dark:text-sky-400" />,
      title: 'Veri Güvenliği',
      description: 'RLS politikaları ile her kullanıcı yalnızca kendi verisine erişir.',
      highlight: 'RLS'
    },
    {
      icon: <FileText className="w-8 h-8 text-blue-600 dark:text-sky-400" />,
      title: 'Dosya Paylaşımı',
      description: 'Sürükle, bırak, gönder. Bu kadar basit.',
      highlight: 'Hızlı'
    },
    {
      icon: <Bell className="w-8 h-8 text-blue-600 dark:text-sky-400" />,
      title: 'Akıllı Bildirimler',
      description: 'Sadece önemli olanı görün. Kontrol sizde.',
      highlight: 'Akıllı'
    },
    {
      icon: <Search className="w-8 h-8 text-blue-600 dark:text-sky-400" />,
      title: 'Gelişmiş Arama',
      description: 'Geçmiş mesajlara saniyeler içinde ulaşın.',
      highlight: 'Hızlı'
    },
    {
      icon: <Globe className="w-8 h-8 text-blue-600 dark:text-sky-400" />,
      title: 'Her Yerden Erişim',
      description: 'Web, mobil ve masaüstünde senkronize.',
      highlight: 'Her Yerden'
    },
    {
      icon: <Zap className="w-8 h-8 text-blue-600 dark:text-sky-400" />,
      title: 'WebSocket Tabanlı',
      description: 'Kalıcı bağlantı sayesinde gereksiz istek yok, anlık iletim var.',
      highlight: 'WebSocket'
    },
  ]

  const detailedFeatures = [
    {
      category: 'Güvenlik',
      items: [
        'RLS tabanlı veri izolasyonu',
        'OAuth entegrasyonu (Google, GitHub)',
        'Otomatik oturum yönetimi',
        'Gizlilik odaklı tasarım'
      ]
    },
    {
      category: 'İletişim',
      items: [
        'Gerçek zamanlı mesajlaşma',
        'Yazıyor ve okundu bildirimleri',
        'Grup sohbetleri',
        'Özel mesajlaşma'
      ]
    },
    {
      category: 'Organizasyon',
      items: [
        'Oda yönetimi',
        'Üye davet sistemi',
        'Mesaj silme',
        'Okunmamış mesaj takibi'
      ]
    },
    {
      category: 'Performans',
      items: [
        'WebSocket ile anlık iletim',
        'Akıllı önbellekleme ve batch güncelleme',
        'Optimize edilmiş yükleme',
        'Kalıcı bağlantı mimarisi'
      ]
    }
  ]

  const stats = [
    { number: 'Anlık', label: 'Gerçek Zamanlı İletim', icon: <Zap className="w-6 h-6" /> },
    { number: 'WebSocket', label: 'Kalıcı Bağlantı', icon: <Zap className="w-6 h-6" /> },
    { number: '∞', label: 'Sınırsız Grup', icon: <Users className="w-6 h-6" /> },
    { number: '24/7', label: 'Sürekli Erişim', icon: <Clock className="w-6 h-6" /> },
  ]

  return (
    <div className="min-h-[100dvh] bg-white dark:bg-slate-950 text-slate-900 dark:text-white transition-colors">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-b border-slate-100 dark:border-slate-800 transition-colors">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 md:h-20 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={onBack}>
            <img src="/favicon-active.svg" alt="Blink Logo" className="w-8 h-8 md:w-10 md:h-10" />
            <span className="text-xl md:text-2xl font-black tracking-tight text-slate-900 dark:text-white">Blink</span>
          </div>
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-slate-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-sky-400 font-bold text-sm transition-all group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Geri Dön
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-28 md:pt-40 pb-16 md:pb-20 px-4 md:px-6 relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-64 md:w-96 h-64 md:h-96 bg-blue-50 dark:bg-blue-900/10 rounded-full blur-3xl opacity-50 -z-10"></div>
        <div className="absolute top-1/2 -left-20 w-48 md:w-64 h-48 md:h-64 bg-indigo-50 dark:bg-indigo-900/10 rounded-full blur-3xl opacity-50 -z-10"></div>

        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-sky-400 px-3 md:px-4 py-1.5 md:py-2 rounded-full mb-6 md:mb-8 border border-blue-100 dark:border-blue-900/20">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
            <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider">Tüm Özellikler</span>
          </div>

          <h1 className="text-4xl sm:text-6xl md:text-8xl font-black text-slate-900 dark:text-white leading-tight mb-6 md:mb-8 tracking-tighter">
            Sohbet Deneyiminizi <br className="hidden sm:block" />
            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-sky-400 dark:to-indigo-400 bg-clip-text text-transparent">Yükseltin</span>
          </h1>

          <p className="max-w-2xl mx-auto text-base md:text-xl text-slate-500 dark:text-gray-400 mb-8 md:mb-12 font-medium leading-relaxed">
            Modern iletişim için ihtiyacınız olan her şey tek bir platformda. Gereksiz detaylardan arındırılmış, sadece odaklanmanız gereken özellikler.
          </p>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 md:py-16 px-4 md:px-6 bg-slate-50/50 dark:bg-slate-900/50 transition-colors">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 md:w-16 md:h-16 bg-blue-50 dark:bg-blue-900/20 rounded-xl md:rounded-2xl mb-4 text-blue-600 dark:text-sky-400 font-black">
                  {stat.icon}
                </div>
                <div className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white mb-2">{stat.number}</div>
                <div className="text-sm md:text-base text-slate-500 dark:text-gray-400 font-medium">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Main Features Grid */}
      <section className="py-16 md:py-32 px-4 md:px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12 md:mb-20">
            <h2 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white mb-4 md:mb-6 tracking-tight">
              Güçlü Özellikler
            </h2>
            <p className="max-w-2xl mx-auto text-base md:text-lg text-slate-500 dark:text-gray-400 font-medium leading-relaxed">
              Her detay düşünülmüş, her özellik optimize edilmiş. İşte Blink'i özel kılan özellikler.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
            {mainFeatures.map((feature, index) => (
              <div key={index} className="bg-white dark:bg-slate-900 p-6 md:p-10 rounded-2xl md:rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-xl hover:-translate-y-2 transition-all duration-300 group">
                <div className="w-12 h-12 md:w-16 md:h-16 bg-blue-50 dark:bg-blue-900/20 rounded-xl md:rounded-2xl flex items-center justify-center mb-6 md:mb-8 shrink-0 group-hover:scale-110 transition-transform">
                  {feature.icon}
                </div>
                <div className="inline-block px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-sky-400 rounded-full text-xs font-bold mb-3">
                  {feature.highlight}
                </div>
                <h3 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white mb-2 md:mb-4">{feature.title}</h3>
                <p className="text-sm md:text-base text-slate-500 dark:text-gray-400 font-medium leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Detailed Features */}
      <section className="py-16 md:py-32 px-4 md:px-6 bg-slate-50/50 dark:bg-slate-900/50 transition-colors">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12 md:mb-20">
            <h2 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white mb-4 md:mb-6 tracking-tight">
              Detaylı Özellik Listesi
            </h2>
            <p className="max-w-2xl mx-auto text-base md:text-lg text-slate-500 dark:text-gray-400 font-medium leading-relaxed">
              Her kategori için eksiksiz özellik seti. İhtiyacınız olan her şey burada.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
            {detailedFeatures.map((category, index) => (
              <div key={index} className="bg-white dark:bg-slate-900 p-6 md:p-10 rounded-2xl md:rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-xl transition-all duration-300">
                <h3 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white mb-6 md:mb-8">{category.category}</h3>
                <ul className="space-y-4">
                  {category.items.map((item, itemIndex) => (
                    <li key={itemIndex} className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0 mt-0.5">
                        <CheckCircle2 className="w-3 h-3 text-blue-600 dark:text-sky-400" />
                      </div>
                      <span className="text-sm md:text-base text-slate-600 dark:text-gray-400 font-medium">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 md:py-32 px-4 md:px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 border border-blue-100 dark:border-blue-900/20 rounded-[40px] md:rounded-[60px] p-8 md:p-16">
            <p className="text-base md:text-lg text-slate-600 dark:text-gray-400 mb-8 md:mb-12 font-medium leading-relaxed max-w-2xl mx-auto">
              Tüm bu özellikleri ücretsiz deneyin. Hesap oluşturmanız sadece birkaç saniye sürer.
            </p>
            <button
              onClick={onStart}
              className="group inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 md:px-12 py-4 md:py-5 rounded-2xl font-bold text-base md:text-lg transition-all shadow-xl shadow-blue-100 dark:shadow-none hover:-translate-y-1"
            >
              Ücretsiz Başla
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 dark:bg-slate-950 text-slate-400 py-12 md:py-20 px-4 md:px-6 border-t border-slate-800 transition-colors">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <img src="/favicon-active.svg" alt="Blink Logo" className="w-6 h-6 md:w-8 md:h-8" />
              <span className="text-lg md:text-xl font-black text-white">Blink</span>
            </div>
            <p className="text-[10px] md:text-xs font-medium">© 2024 Blink. Tüm hakları saklıdır.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
