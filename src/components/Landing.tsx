import { Arrow, Menu, IconCircle, Bolt, CardOff, QrIcon, Clock } from "./icons";

export function Landing({ onGetStarted }: { onGetStarted: () => void }) {
  return (
    <div className="fade-in">
      <nav>
        <div className="brand">
          <span className="brand-mark">T</span>Tabclear
        </div>
        <div className="nav-links">
          <a href="#features">Features</a>
          <a href="#how">How it works</a>
          <a href="#compare">Why it's faster</a>
        </div>
        <button className="btn btn-primary small" onClick={onGetStarted}>
          Get started
          <Arrow />
        </button>
      </nav>

      <section className="hero">
        <div>
          <div className="eyebrow">For shops, stalls &amp; small counters</div>
          <h1>
            Get paid the second
            <br />
            they <em>tap.</em>
          </h1>
          <p className="lede">
            Every sale lands in your till the moment it's made. No three-day hold,
            no "processing," no wondering if it went through. Just an instant,
            honest till.
          </p>
          <div className="cta-row">
            <button className="btn btn-primary" onClick={onGetStarted}>
              <IconCircle>
                <Menu />
              </IconCircle>
              Connect &amp; get started
            </button>
            <span className="cta-sub">Free to try · no card reader needed</span>
          </div>
        </div>

        <div className="till-card">
          <div className="till-head">
            <div>
              <div className="label">Today's till</div>
              <div className="till-balance">$1,284.50</div>
            </div>
          </div>
          <div className="till-track">
            <span className="track-label left">Customer taps</span>
            <span className="track-label right">Lands in till</span>
            <div className="coin">$</div>
          </div>
          <div className="compare-row">
            <span>
              Card processor: <b>1–3 days</b>
            </span>
            <span className="instant">
              Tabclear: <b>instant</b>
            </span>
          </div>
        </div>
      </section>

      <section className="section" id="features">
        <h2 className="section-title">Everything your till actually needs.</h2>
        <p className="section-sub">
          No add-ons to configure, no fine print to decode. Four things, done properly.
        </p>
        <div className="features-grid">
          <FeatureCard icon={<Bolt />} title="Instant settlement">
            The moment a customer confirms, the balance on your screen updates. No pending state, ever.
          </FeatureCard>
          <FeatureCard icon={<CardOff />} title="No card reader">
            Show a code, get paid. Nothing to buy, charge, or carry around your counter.
          </FeatureCard>
          <FeatureCard icon={<QrIcon />} title="One-tap requests">
            Generate a payment request in a second and let the customer scan it — no back and forth.
          </FeatureCard>
          <FeatureCard icon={<Clock />} title="Cash out anytime">
            Your money, on your schedule. Move it out the moment you want it, not when a processor allows it.
          </FeatureCard>
        </div>
      </section>

      <section className="section" id="how">
        <h2 className="section-title">Three things happen. That's it.</h2>
        <p className="section-sub">
          No new hardware, no training, no jargon. If you can show someone a screen, you can run your till on Tabclear.
        </p>
        <div className="steps">
          <StepCard num="One" title="Customer taps to pay">
            They scan a code at your counter and confirm the amount — same as any tap-to-pay they already know.
          </StepCard>
          <StepCard num="Two" title="It's in your till instantly">
            No waiting room, no "pending." The number on your screen updates before they've put their phone away.
          </StepCard>
          <StepCard num="Three" title="Cash out whenever">
            Move your day's takings out whenever suits you — end of day, end of week, the moment you need it.
          </StepCard>
        </div>
      </section>

      <section className="section" id="compare">
        <div className="compare-block">
          <div>
            <h2>
              Three days is a long time
              <br />
              to wait for your own money.
            </h2>
            <p>
              Card processors hold your takings while they settle behind the scenes. Tabclear skips the hold entirely — the money is simply yours, right away.
            </p>
          </div>
          <div className="timeline">
            <div className="tl-row card">
              <span className="tl-label">Card processor</span>
              <div className="tl-bar" />
              <span className="tl-time">1–3 days</span>
            </div>
            <div className="tl-row tabclear">
              <span className="tl-label">Tabclear</span>
              <div className="tl-bar" />
              <span className="tl-time">instant</span>
            </div>
          </div>
        </div>
      </section>

      <section className="final-cta">
        <h2>Your till, settled instantly.</h2>
        <p>Set up takes less time than making the coffee you'll sell with it.</p>
        <button className="btn btn-primary" onClick={onGetStarted}>
          Connect &amp; get started
          <Arrow />
        </button>
      </section>

      <footer>
        <div>© 2026 Tabclear</div>
        <div>Built for small counters, everywhere</div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="feature-card">
      <div className="feature-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}

function StepCard({ num, title, children }: { num: string; title: string; children: React.ReactNode }) {
  return (
    <div className="step-card">
      <span className="step-num">{num}</span>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
