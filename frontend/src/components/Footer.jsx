import { Wheat } from 'lucide-react'

export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="footer-wrapper">
      <div className="footer-content">
        <div>
          <div className="footer-brand-title">
            <Wheat size={22} color="var(--accent-gold)" />
            <span>KisaanKhata</span>
          </div>
          <p className="footer-brand-desc">
            Empowering Pakistani smallholder farmers with voice-first ledger logging,
            live AMIS mandi price verification, and cryptographic record integrity.
          </p>
        </div>

        <div>
          <div className="footer-heading">Quick Links</div>
          <ul className="footer-links">
            <li><a href="#hero" className="footer-link">Home</a></li>
            <li><a href="#how-it-works" className="footer-link">How It Works</a></li>
            <li><a href="#features" className="footer-link">Features</a></li>
            <li><a href="#contact" className="footer-link">Contact Us</a></li>
          </ul>
        </div>

        <div>
          <div className="footer-heading">Platform</div>
          <ul className="footer-links">
            <li><a href="#khata-form" className="footer-link">Open Khata</a></li>
            <li><a href="#contact" className="footer-link">Support Helpline</a></li>
          </ul>
        </div>
      </div>

      <div className="footer-bottom">
        <div>&copy; {currentYear} KisaanKhata. All rights reserved.</div>
        <div>Built for Pakistan's Agricultural Community</div>
      </div>
    </footer>
  )
}
