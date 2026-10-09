import { Wheat } from 'lucide-react'
import { useI18n } from '../i18n/useI18n'
import { API_ROOT } from '../api'

export default function Footer() {
  const { t } = useI18n()
  const currentYear = new Date().getFullYear()
  const docsUrl = `${API_ROOT}/docs`

  return (
    <footer className="footer-wrapper t-dark">
      <div className="container">
        <div className="footer-content">
          <div>
            <div className="navbar-brand">
              <span className="brand-mark"><Wheat size={20} /></span>
              <span>{t('brand')}</span>
            </div>
            <p className="footer-brand-desc">{t('footer.desc')}</p>
          </div>

          <div>
            <div className="footer-heading">{t('footer.quickLinks')}</div>
            <ul className="footer-links">
              <li><a href="#features" className="footer-link">{t('nav.features')}</a></li>
              <li><a href="#how-it-works" className="footer-link">{t('nav.howItWorks')}</a></li>
              <li><a href="#price-check" className="footer-link">{t('nav.priceCheck')}</a></li>
              <li><a href="#contact" className="footer-link">{t('nav.contact')}</a></li>
            </ul>
          </div>

          <div>
            <div className="footer-heading">{t('footer.platform')}</div>
            <ul className="footer-links">
              <li><a href="#khata-form" className="footer-link">{t('footer.openKhata')}</a></li>
              <li><a href={docsUrl} target="_blank" rel="noreferrer" className="footer-link">{t('footer.apiDocs')}</a></li>
              <li><a href="https://github.com/DarainHyder/KisaanKhata" target="_blank" rel="noreferrer" className="footer-link">GitHub</a></li>
            </ul>
          </div>
        </div>

        <div className="footer-word" aria-hidden="true">
          <span className="fw-en">KisaanKhata</span>
          <span className="fw-ur" lang="ur" dir="rtl">کسان کھاتہ</span>
        </div>

        <p className="footer-credits">{t('footer.credits')}</p>

        <div className="footer-bottom">
          <div>{t('footer.copyright', { year: currentYear })}</div>
          <div>{t('footer.builtFor')}</div>
        </div>
      </div>
    </footer>
  )
}
