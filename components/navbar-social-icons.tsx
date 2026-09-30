"use client"

const INSTAGRAM_URL = "https://www.instagram.com/medclassunr"
const SUPORTE_URL = "https://wa.me/543417214945"

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.4" cy="6.6" r="1.15" fill="currentColor" stroke="none" />
    </svg>
  )
}

function WhatsappIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="currentColor">
      <path d="M16.004 3C9.377 3 4 8.373 4 15c0 2.34.663 4.523 1.813 6.377L4 29l7.803-1.777A11.93 11.93 0 0 0 16.004 27C22.63 27 28 21.627 28 15S22.63 3 16.004 3Zm0 21.7c-1.95 0-3.766-.55-5.312-1.5l-.38-.226-4.63 1.054 1.077-4.51-.248-.393A9.65 9.65 0 0 1 5.3 15c0-5.907 4.802-10.7 10.704-10.7 5.902 0 10.696 4.793 10.696 10.7s-4.794 10.7-10.696 10.7Zm5.86-8.01c-.32-.16-1.892-.933-2.185-1.04-.293-.107-.507-.16-.72.16-.213.32-.827 1.04-1.014 1.253-.187.213-.373.24-.693.08-.32-.16-1.35-.497-2.572-1.585-.95-.847-1.592-1.893-1.778-2.213-.187-.32-.02-.493.14-.653.144-.143.32-.373.48-.56.16-.187.213-.32.32-.533.107-.213.053-.4-.027-.56-.08-.16-.72-1.733-.986-2.373-.26-.626-.524-.54-.72-.55l-.613-.01c-.213 0-.56.08-.853.4-.293.32-1.12 1.093-1.12 2.666 0 1.573 1.146 3.093 1.306 3.307.16.213 2.253 3.44 5.46 4.826.763.33 1.36.527 1.825.674.767.244 1.465.21 2.017.127.615-.092 1.892-.773 2.16-1.52.267-.746.267-1.386.187-1.52-.08-.133-.293-.213-.613-.373Z" />
    </svg>
  )
}

export function NavbarSocialIcons() {
  return (
    <div className="flex items-center gap-1.5">
      <a
        href={INSTAGRAM_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Instagram"
        title="Instagram"
        className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-[#feda75] via-[#d62976] to-[#4f5bd5] text-white transition-transform hover:scale-110"
      >
        <InstagramIcon className="h-4 w-4" />
      </a>
      <a
        href={SUPORTE_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="WhatsApp"
        title="WhatsApp"
        className="flex h-8 w-8 items-center justify-center rounded-full bg-[#25D366] text-white transition-transform hover:scale-110"
      >
        <WhatsappIcon className="h-4 w-4" />
      </a>
    </div>
  )
}
