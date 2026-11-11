export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white/80">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 md:grid-cols-4 md:px-8">
        <div>
          <div className="text-lg font-black tracking-tight text-emerald-950">Cash <span className="text-orange-500">N</span> Carry</div>
          <p className="mt-3 text-sm text-slate-500">Nigeria’s live shopping marketplace for discovery, trusted brands and local commerce.</p>
        </div>
        <div>
          <h3 className="text-xs font-extrabold uppercase tracking-[0.16em] text-slate-900">Discover</h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-500">
            <li>Live Shop</li>
            <li>Flash Deals</li>
            <li>Top Stores</li>
            <li>New Arrivals</li>
          </ul>
        </div>
        <div>
          <h3 className="text-xs font-extrabold uppercase tracking-[0.16em] text-slate-900">Sell with us</h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-500">
            <li>Open your store</li>
            <li>Seller portal</li>
            <li>Seller guidelines</li>
            <li>Commission rates</li>
          </ul>
        </div>
        <div>
          <h3 className="text-xs font-extrabold uppercase tracking-[0.16em] text-slate-900">Policies</h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-500">
            <li>Terms</li>
            <li>Privacy</li>
            <li>Returns</li>
            <li>Support</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-slate-200 py-4 text-center text-[10px] uppercase tracking-[0.12em] text-slate-400">© 2026 Cash N Carry Nigeria</div>
    </footer>
  );
}
