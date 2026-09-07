import { Wheat } from 'lucide-react'
import { useI18n } from '../i18n/useI18n'

export default function Footer() {
  const { t } = useI18n()
  const currentYear = new Date().getFullYear()

  return (
    <footer className="footer-wrapper">
      <div className="footer-content">
        <div>
          <div className="footer-brand-title">
            <Wheat size={22} color="var(--accent-gold)" />
            <span>{t('brand')}</span>
          </div>
          <p className="footer-brand-desc">
            {t('footer.desc')}
          </p>
        </div>

        <div>
          <div className="footer-heading">{t('footer.quickLinks')}</div>
          <ul className="footer-links">
            <li><a href="#hero" className="footer-link">{t('nav.home')}</a></li>
            <li><a href="#how-it-works" className="footer-link">{t('nav.howItWorks')}</a></li>
            <li><a href="#features" className="footer-link">{t('nav.features')}</a></li>
            <li><a href="#contact" className="footer-link">{t('nav.contact')}</a></li>
          </ul>
        </div>

        <div>
          <div className="footer-heading">{t('footer.platform')}</div>
          <ul className="footer-links">
            <li><a href="#khata-form" className="footer-link">{t('footer.openKhata')}</a></li>
            <li><a href="#contact" className="footer-link">{t('footer.supportHelpline')}</a></li>
          </ul>
        </div>
      </div>

      <div className="footer-bottom">
        <div>{t('footer.copyright', { year: currentYear })}</div>
        <div>{t('footer.builtFor')}</div>
      </div>
    </footer>
  )
}
