export function WhatsAppContact() {
  return <a href="https://wa.me/905349264588" target="_blank" rel="noopener noreferrer"
    aria-label="Sorularınız için WhatsApp'tan Aksoy Tuning'e yazın"
    className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 inline-flex items-center gap-3 rounded-full bg-[#128c4a] p-3 text-white shadow-lg transition hover:bg-[#0d713b] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-green-700 sm:right-6 sm:px-5">
    <svg viewBox="0 0 32 32" className="size-7 shrink-0" fill="currentColor" aria-hidden="true">
      <path d="M16 .8A15.1 15.1 0 0 0 2.9 23.4L.8 31.2l8-2.1A15.2 15.2 0 1 0 16 .8Zm0 27.7a12.5 12.5 0 0 1-6.4-1.8l-.5-.3-4.8 1.3 1.3-4.7-.3-.5A12.5 12.5 0 1 1 16 28.5Zm6.9-9.3c-.4-.2-2.2-1.1-2.5-1.2-.4-.1-.6-.2-.9.2-.2.4-.9 1.2-1.1 1.4-.2.2-.4.3-.8.1-.4-.2-1.5-.6-2.9-1.8-1.1-1-1.8-2.2-2-2.6-.2-.4 0-.6.2-.8l.6-.7.4-.6c.1-.2 0-.5 0-.7l-1.1-2.6c-.3-.7-.6-.6-.9-.6h-.7c-.2 0-.6.1-.9.4-.3.4-1.3 1.3-1.3 3.1s1.3 3.5 1.5 3.7c.2.3 2.6 4 6.4 5.6.9.4 1.6.6 2.1.7.9.3 1.7.2 2.3.2.7-.1 2.2-.9 2.5-1.8.3-.9.3-1.6.2-1.8-.1-.1-.3-.2-.7-.4Z" />
    </svg>
    <span className="hidden text-left text-sm font-bold sm:block"><span className="block text-[11px] font-medium text-green-100">Sorularınız için</span>WhatsApp&apos;tan yazın</span>
    <span className="sr-only sm:hidden">WhatsApp iletişim</span>
  </a>;
}
