import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import './Landing.css';

const Landing = () => {
  useEffect(() => {
    const btn = document.getElementById('themebtn');
    const onClick = () => {
      let cur = document.documentElement.getAttribute('data-theme');
      if (!cur) {
        cur = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      document.documentElement.setAttribute('data-theme', cur === 'dark' ? 'light' : 'dark');
    };
    btn?.addEventListener('click', onClick);

    let io: IntersectionObserver | undefined;
    const els = document.querySelectorAll('.rv');
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window) {
      io = new IntersectionObserver(
        (es) => {
          es.forEach((e, i) => {
            if (e.isIntersecting) {
              (e.target as HTMLElement).style.transitionDelay = Math.min(i * 70, 280) + 'ms';
              e.target.classList.add('in');
              io?.unobserve(e.target);
            }
          });
        },
        { rootMargin: '0px 0px -8% 0px', threshold: 0.12 }
      );
      els.forEach((el) => io?.observe(el));
    } else {
      els.forEach((el) => el.classList.add('in'));
    }

    return () => {
      btn?.removeEventListener('click', onClick);
      io?.disconnect();
    };
  }, []);

  return (
    <>
      <nav className="nav">
        <div className="wrap nav-in">
          <a className="mark" href="#top">
            <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
              <rect x="1" y="1" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.2" />
              <line x1="1" y1="14.5" x2="21" y2="14.5" stroke="currentColor" strokeWidth="1.2" />
              <rect x="5" y="8" width="4" height="6.5" fill="var(--acid)" />
              <rect x="12" y="4.5" width="4" height="10" fill="none" stroke="currentColor" strokeWidth="1.2" />
            </svg>
            Groundwork
          </a>
          <div className="nav-links">
            <a href="#tiers">Tiers</a>
            <a href="#dashboard">The number</a>
            <a href="#method">Method</a>
            <a href="#benchmark">Benchmarking</a>
          </div>
          <button className="themebtn" id="themebtn" aria-label="Toggle colour theme">
            <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M8 1.5a6.5 6.5 0 1 0 6.5 6.5A5 5 0 0 1 8 1.5Z" fill="currentColor" />
            </svg>
          </button>
          <Link className="btn btn-sm" to="/login" style={{ marginLeft: '14px' }}>
            Start a school file
          </Link>
        </div>
      </nav>

      <header className="hero" id="top">
        <div className="wrap">
          <div className="hero-grid">
            <div>
              <div className="eyebrow">Carbon accounting for physical schools</div>
              <h1 style={{ marginTop: '22px' }}>
                Report what you
                <br />
                <span className="em">actually</span> <span className="mk">know</span>.
                <br />
                Estimate the rest — <span className="em">visibly</span>.
              </h1>
              <p className="lede">
                Most school sustainability tools grade a whole campus at one level of rigour, so the weakest data
                drags down everything. Groundwork lets each of five categories sit at <b>its own data tier</b> —
                meter-level on energy, back-of-envelope on transport — and shows the{' '}
                <b>uncertainty that follows from that choice</b> instead of hiding it behind a single tidy figure.
              </p>
              <div className="hero-cta">
                <Link className="btn" to="/login">
                  Start a school file
                  <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden="true">
                    <path d="M1 7h11M7.5 2.5 12 7l-4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
                  </svg>
                </Link>
                <a className="btn ghost" href="#method">
                  Read the method
                </a>
                <span className="hero-note">No procurement call. Start with one utility bill.</span>
              </div>
            </div>

            <figure className="hero-fig rv">
              <svg
                viewBox="0 0 460 268"
                width="100%"
                role="img"
                aria-label="Chart showing five emission categories, each with a confidence range that narrows as the data tier improves"
              >
                <defs>
                  <pattern id="hatch" width="5" height="5" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
                    <line x1="0" y1="0" x2="0" y2="5" stroke="var(--blue)" strokeWidth="2.4" opacity=".28" />
                  </pattern>
                </defs>
                <g fontFamily="IBM Plex Mono, monospace" fontSize="9.5" fill="var(--ink-faint)" letterSpacing="1">
                  <text x="0" y="12">tCO₂e</text>
                  <text x="404" y="12">TIER</text>
                </g>
                {/* axis */}
                <line x1="0" y1="232" x2="460" y2="232" stroke="var(--rule)" strokeWidth="1" />
                <g stroke="var(--rule-soft)" strokeWidth="1" strokeDasharray="2 4">
                  <line x1="110" y1="26" x2="110" y2="232" />
                  <line x1="200" y1="26" x2="200" y2="232" />
                  <line x1="290" y1="26" x2="290" y2="232" />
                  <line x1="380" y1="26" x2="380" y2="232" />
                </g>
                {/* rows */}
                <g fontFamily="IBM Plex Sans, sans-serif" fontSize="11" fill="var(--ink)">
                  <g>
                    <text x="0" y="45">Energy</text>
                    <rect x="110" y="36" width="66" height="12" fill="var(--band)" />
                    <rect x="139" y="33" width="3" height="18" fill="var(--blue)" />
                    <text x="404" y="46" fontFamily="IBM Plex Mono, monospace" fontSize="9.5" fill="var(--blue-ink)">T3</text>
                  </g>
                  <g>
                    <text x="0" y="85">Water</text>
                    <rect x="128" y="76" width="96" height="12" fill="var(--band)" />
                    <rect x="172" y="73" width="3" height="18" fill="var(--blue)" />
                    <text x="404" y="86" fontFamily="IBM Plex Mono, monospace" fontSize="9.5" fill="var(--blue-ink)">T2</text>
                  </g>
                  <g>
                    <text x="0" y="125">Transport</text>
                    <rect x="132" y="116" width="236" height="12" fill="url(#hatch)" />
                    <rect x="132" y="116" width="236" height="12" fill="none" stroke="var(--blue)" strokeWidth="1" strokeDasharray="3 3" opacity=".7" />
                    <rect x="238" y="113" width="3" height="18" fill="var(--blue)" />
                    <text x="404" y="126" fontFamily="IBM Plex Mono, monospace" fontSize="9.5" fill="var(--ink-faint)">T1</text>
                  </g>
                  <g>
                    <text x="0" y="165">Digital</text>
                    <rect x="104" y="156" width="120" height="12" fill="var(--band)" />
                    <rect x="152" y="153" width="3" height="18" fill="var(--blue)" />
                    <text x="404" y="166" fontFamily="IBM Plex Mono, monospace" fontSize="9.5" fill="var(--blue-ink)">T2</text>
                  </g>
                  <g>
                    <text x="0" y="205">Waste</text>
                    <rect x="112" y="196" width="196" height="12" fill="url(#hatch)" />
                    <rect x="112" y="196" width="196" height="12" fill="none" stroke="var(--blue)" strokeWidth="1" strokeDasharray="3 3" opacity=".7" />
                    <rect x="190" y="193" width="3" height="18" fill="var(--blue)" />
                    <text x="404" y="206" fontFamily="IBM Plex Mono, monospace" fontSize="9.5" fill="var(--ink-faint)">T1</text>
                  </g>
                </g>
                <g fontFamily="IBM Plex Mono, monospace" fontSize="9" fill="var(--ink-faint)">
                  <text x="102" y="246">40</text>
                  <text x="192" y="246">80</text>
                  <text x="282" y="246">120</text>
                  <text x="372" y="246">160</text>
                </g>
                <g>
                  <line x1="0" y1="258" x2="16" y2="258" stroke="var(--blue)" strokeWidth="10" opacity=".16" />
                  <text x="22" y="261" fontFamily="IBM Plex Mono, monospace" fontSize="9" fill="var(--ink-faint)">MEASURED RANGE</text>
                  <rect x="150" y="253" width="16" height="10" fill="url(#hatch)" />
                  <text x="172" y="261" fontFamily="IBM Plex Mono, monospace" fontSize="9" fill="var(--ink-faint)">MODELLED RANGE</text>
                </g>
              </svg>
              <figcaption>
                Illustrative output. Each bar is a simulated confidence range, not a point estimate — the hatched
                bars are categories still sitting on Tier 1 inputs, and they look uncertain because they are.
              </figcaption>
            </figure>
          </div>

          <div className="hero-tail">
            <div className="fact rv">
              <span className="n">5</span>
              <span className="t">Categories: energy, water, transportation, digital, waste. Turn on only the ones you can currently answer.</span>
            </div>
            <div className="fact rv">
              <span className="n">
                3 <em>× per category</em>
              </span>
              <span className="t">Tiers of data quality, set independently. Nothing forces the whole school down to its weakest source.</span>
            </div>
            <div className="fact rv">
              <span className="n">
                0 <em>schools so far</em>
              </span>
              <span className="t">Pre-launch, and we'd rather say so. There is no peer cohort yet — the benchmarking layer stays switched off until there honestly is one.</span>
            </div>
          </div>
        </div>
      </header>

      <section id="tiers">
        <div className="wrap">
          <div className="sec-head rv">
            <div className="eyebrow">Breadth × depth</div>
            <h2>One grade for the whole building is the wrong shape for a school.</h2>
            <p>
              The facilities office has twelve months of half-hourly meter data. Nobody has ever surveyed how the
              Year 8s get to school. Those two facts should not have to average into a single credibility score —
              so here they don't.
            </p>
          </div>

          <div className="two rv">
            <div className="panel">
              <div className="kick">How it usually goes</div>
              <h3>A single rigour setting</h3>
              <p className="strike">
                Pick "simple" and your good energy data is thrown away. Pick "comprehensive" and you're blocked at
                the first field you can't fill — usually a commuting question no school has ever been asked before.
              </p>
              <p className="strike">The output is one number with no stated error, which is exactly the number a board member will ask you to defend.</p>
            </div>
            <div className="panel b">
              <div className="kick">How Groundwork goes</div>
              <h3>A tier per category, changeable any week</h3>
              <p>
                Upload the electricity bills today and energy jumps to Tier 2 on its own. Run a mode-share survey
                in March and transportation moves up while nothing else is touched.
              </p>
              <p>
                Every category carries its tier as a visible badge, and the confidence range around its number
                widens or narrows to match. Improving your data is something you can literally watch happen.
              </p>
            </div>
          </div>

          <div className="matrix rv">
            <table>
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Tier 1 — Estimate</th>
                  <th>Tier 2 — Actual totals</th>
                  <th>Tier 3 — Granular</th>
                </tr>
              </thead>
              <tbody>
                <tr className="live">
                  <td className="cat">
                    Energy
                    <span>Live first</span>
                  </td>
                  <td className="cell">
                    <span className="pip">FLOOR AREA + ROLL</span>
                    <br />
                    Peer-median intensity applied as a proxy. Wide band.
                  </td>
                  <td className="cell">
                    <span className="pip">ANNUAL BILL TOTALS</span>
                    <br />
                    Twelve months of kWh as billed. What most schools can find in an afternoon.
                  </td>
                  <td className="cell">
                    <span className="pip">MONTHLY / MULTI-METER</span>
                    <br />
                    Per-meter reads with period dates. Tightest band available.
                  </td>
                </tr>
                <tr>
                  <td className="cat">
                    Water
                    <span>Next</span>
                  </td>
                  <td className="cell">
                    <span className="pip">LITRES PER PUPIL</span>
                    <br />
                    Regional per-pupil-day figure × enrolment.
                  </td>
                  <td className="cell">
                    <span className="pip">ANNUAL SUPPLY BILL</span>
                    <br />
                    Billed volume, split by metered supply point.
                  </td>
                  <td className="cell">
                    <span className="pip">SUB-METERED</span>
                    <br />
                    Irrigation, catering and sanitary loads separated.
                  </td>
                </tr>
                <tr>
                  <td className="cat">
                    Transportation
                    <span>Novel ground</span>
                  </td>
                  <td className="cell">
                    <span className="pip">REGIONAL PROXY</span>
                    <br />
                    One dropdown for setting and catchment size.
                  </td>
                  <td className="cell">
                    <span className="pip">MODE-SHARE SURVEY</span>
                    <br />
                    Annual survey plus postcode distance bands. Needs 60% response to count.
                  </td>
                  <td className="cell">
                    <span className="pip">TERMLY + TELEMETRY</span>
                    <br />
                    Repeat surveys and route-level fleet data.
                  </td>
                </tr>
                <tr>
                  <td className="cat">
                    Digital
                    <span>Engine exists</span>
                  </td>
                  <td className="cell">
                    <span className="pip">DEVICE COUNT</span>
                    <br />
                    Fleet size × typical duty-cycle assumptions.
                  </td>
                  <td className="cell">
                    <span className="pip">PLATFORM EXPORTS</span>
                    <br />
                    Real hours from the tools you already licence.
                  </td>
                  <td className="cell">
                    <span className="pip">PER-COHORT USAGE</span>
                    <br />
                    Device-hours and streaming split by year group.
                  </td>
                </tr>
                <tr>
                  <td className="cat">
                    Waste &amp; food
                    <span>Later</span>
                  </td>
                  <td className="cell">
                    <span className="pip">COVERS SERVED</span>
                    <br />
                    Meals per day against a published diet-emissions dataset.
                  </td>
                  <td className="cell">
                    <span className="pip">CONTRACTOR TONNAGE</span>
                    <br />
                    Collection weights by stream from your waste contract.
                  </td>
                  <td className="cell">
                    <span className="pip">AUDITED STREAMS</span>
                    <br />
                    Bin audits and menu-level procurement data.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="matrix-note">
            Green row is what's being built first. The rest are specified, not shipped — and the product will say
            so inside the app rather than showing a greyed-out tab that implies otherwise.
          </p>
        </div>
      </section>

      <section id="dashboard">
        <div className="wrap">
          <div className="sec-head rv">
            <div className="eyebrow">The number, and its edges</div>
            <h2>Every figure arrives as a range, because every input is one.</h2>
            <p>
              Emission factors are published as intervals, not constants. Groundwork simulates across those
              intervals thousands of times and reports the spread that comes back. A Tier 1 category produces a
              wide band automatically; a Tier 3 one produces a narrow band automatically. There is no separate
              confidence score to argue about — the width <i>is</i> the score.
            </p>
          </div>

          <div className="dash rv">
            <div className="dash-bar">
              <span className="dot"></span>
              <span className="dot"></span>
              <span className="dot"></span>
              <span className="mono" style={{ marginLeft: '8px' }}>
                Northfield Academy &nbsp;·&nbsp; 01 Sep 2025 → 31 Aug 2026 &nbsp;·&nbsp; 12 months
              </span>
            </div>
            <div className="dash-body">
              <div className="dash-left">
                <div className="total">
                  <span className="big">1,184</span>
                  <span className="pm">tCO₂e &nbsp;·&nbsp; 90% range 1,046 – 1,392 &nbsp;·&nbsp; ±14.6%</span>
                </div>
                <p style={{ fontSize: '13.5px', color: 'var(--ink-faint)', marginBottom: '8px' }}>
                  Sample school. Figures are illustrative.
                </p>
                <hr className="rule" style={{ margin: '14px 0 4px' }} />

                <div className="row">
                  <div className="name">
                    Energy <span className="tierbadge t3">T3</span>
                  </div>
                  <svg viewBox="0 0 300 20" width="100%" height="20" aria-hidden="true">
                    <line x1="0" y1="10" x2="300" y2="10" stroke="var(--rule-soft)" />
                    <rect x="52" y="4" width="44" height="12" fill="var(--band)" />
                    <rect x="72" y="1" width="2.5" height="18" fill="var(--blue)" />
                  </svg>
                  <div className="val">612 ±4%</div>
                </div>
                <div className="row">
                  <div className="name">
                    Transport <span className="tierbadge">T1</span>
                  </div>
                  <svg viewBox="0 0 300 20" width="100%" height="20" aria-hidden="true">
                    <line x1="0" y1="10" x2="300" y2="10" stroke="var(--rule-soft)" />
                    <rect x="46" y="4" width="176" height="12" fill="var(--band)" stroke="var(--blue)" strokeDasharray="3 3" strokeWidth="1" />
                    <rect x="126" y="1" width="2.5" height="18" fill="var(--blue)" />
                  </svg>
                  <div className="val">318 ±41%</div>
                </div>
                <div className="row">
                  <div className="name">
                    Water <span className="tierbadge t2">T2</span>
                  </div>
                  <svg viewBox="0 0 300 20" width="100%" height="20" aria-hidden="true">
                    <line x1="0" y1="10" x2="300" y2="10" stroke="var(--rule-soft)" />
                    <rect x="24" y="4" width="58" height="12" fill="var(--band)" />
                    <rect x="50" y="1" width="2.5" height="18" fill="var(--blue)" />
                  </svg>
                  <div className="val">141 ±11%</div>
                </div>
                <div className="row">
                  <div className="name">
                    Digital <span className="tierbadge t2">T2</span>
                  </div>
                  <svg viewBox="0 0 300 20" width="100%" height="20" aria-hidden="true">
                    <line x1="0" y1="10" x2="300" y2="10" stroke="var(--rule-soft)" />
                    <rect x="12" y="4" width="52" height="12" fill="var(--band)" />
                    <rect x="34" y="1" width="2.5" height="18" fill="var(--blue)" />
                  </svg>
                  <div className="val">83 ±13%</div>
                </div>
                <div className="row">
                  <div className="name">
                    Waste <span className="tierbadge">T1</span>
                  </div>
                  <svg viewBox="0 0 300 20" width="100%" height="20" aria-hidden="true">
                    <line x1="0" y1="10" x2="300" y2="10" stroke="var(--rule-soft)" />
                    <rect x="6" y="4" width="72" height="12" fill="var(--band)" stroke="var(--blue)" strokeDasharray="3 3" strokeWidth="1" />
                    <rect x="36" y="1" width="2.5" height="18" fill="var(--blue)" />
                  </svg>
                  <div className="val">30 ±58%</div>
                </div>
              </div>

              <div className="dash-right">
                <h4>Where the uncertainty actually lives</h4>
                <p>
                  Transport is 27% of this school's footprint and carries almost all of its error. Running one
                  mode-share survey would cut the whole-school range by roughly a third — worth more than another
                  year of half-hourly meter data.
                </p>
                <p>Groundwork ranks that for you, so the next thing you spend a term on is the thing that moves the number.</p>
                <div className="cold">
                  <div className="mono">Peer standing</div>
                  <p style={{ marginTop: '8px', fontSize: '13.5px' }}>
                    Locked. Percentile ranking needs a real cohort of comparable schools — same setting, same
                    climate region, same data tier — and that cohort doesn't exist yet. You'll see a bar here when
                    it does, and not before.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="method">
        <div className="wrap">
          <div className="sec-head rv">
            <div className="eyebrow">How a number gets made</div>
            <h2>Four steps, each one auditable a year later.</h2>
            <p>Nothing is derived from a source we can't point at, and nothing enters your file without a human agreeing to it first.</p>
          </div>

          <div className="steps">
            <div className="step rv">
              <div className="num">01</div>
              <h3>Give the period, not the year</h3>
              <p>
                Every row carries an explicit start and end date. An August-to-July academic year and a
                January-to-December calendar year are both twelve months and both usable; a five-week snapshot is
                labelled a spot check and never annualised by naive multiplication.
              </p>
              <div className="src">Partial years are extended using a seasonal shape derived from public degree-day data and a term calendar, and marked "modelled".</div>
            </div>
            <div className="step rv">
              <div className="num">02</div>
              <h3>Get the data in three ways</h3>
              <p>
                Photograph a bill and let extraction read it, import a spreadsheet with explicit column mapping,
                or type one meter read at a time. Extracted fields always land in a review screen beside the
                original document — never straight into your file.
              </p>
              <div className="src">Ambiguous fields — a consumption figure sitting next to a demand charge — raise a written warning, not a quiet lower score.</div>
            </div>
            <div className="step rv">
              <div className="num">03</div>
              <h3>Convert once, at the door</h3>
              <p>
                Enter therms, gallons, miles, whatever your invoices use. Everything is normalised to one internal
                unit set on the way in, so nothing downstream has to guess, and you never see units you don't use.
              </p>
              <div className="src">Your local units are what's shown back to you on every screen and in every export.</div>
            </div>
            <div className="step rv">
              <div className="num">04</div>
              <h3>Simulate, then report the spread</h3>
              <p>
                Each factor is sampled across its published interval thousands of times. What you get back is a
                central figure and a stated confidence range — the same shape of result a reviewer would accept
                from an environmental consultancy.
              </p>
              <div className="src">
                Factors are drawn from a published multi-property peer study of school buildings, a national
                building-energy survey, an internationally recognised value-chain commuting methodology adapted
                for schools, and a peer-reviewed food-emissions dataset.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="benchmark">
        <div className="wrap pull">
          <div className="rv">
            <blockquote>
              "Roughly a third lower than similar schools" is a claim. <span className="em">1,046 to 1,392 tonnes, transport modelled</span> is a disclosure.
            </blockquote>
          </div>
          <div className="rv">
            <p>
              Groundwork is built for the moment after the report is published — the parent email, the board
              follow-up, the local paper. A stated range holds up under that. A confident single figure with
              undocumented assumptions behind it does not, and in some jurisdictions it is a liability rather than
              an embarrassment.
            </p>
            <p>
              So the software refuses a few things on your behalf: it won't promote a category to a higher tier
              because you'd like it to, it won't fill a gap with an unlabelled assumption, and it won't show you a
              percentile against a peer group that doesn't exist yet.
            </p>
            <div className="legal">
              Environmental claims made to the public are regulated in several jurisdictions, including under US
              federal guidance on environmental marketing and state consumer-protection statutes. Overstated
              precision is one of the specific failure modes those rules describe. Every Groundwork export carries
              its method, its period, its tier per category and its range — the things a regulator or a journalist
              would ask for.
            </div>
          </div>
        </div>
      </section>

      <section className="cta" id="cta">
        <div className="wrap cta-in">
          <div className="rv">
            <div className="eyebrow">Pre-launch · Founding schools</div>
            <h2 style={{ marginTop: '20px' }}>
              Bring one electricity bill.
              <br />
              That's a real starting point.
            </h2>
            <p>
              Energy at Tier 2 in a single sitting is enough for a defensible first number with an honest range on
              it. Everything else can stay at Tier 1 until the term you have time for it.
            </p>
            <div className="hero-cta">
              <Link className="btn" to="/login">
                Start a school file
                <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden="true">
                  <path d="M1 7h11M7.5 2.5 12 7l-4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
                </svg>
              </Link>
              <a className="btn ghost" href="#method">
                Send the method to your business office
              </a>
            </div>
          </div>
          <ul className="checks rv">
            <li>One school, one file — not a district rollout to get started</li>
            <li>Your submitted data is yours; nothing is published without you</li>
            <li>Student surveys collect mode and postcode only — never a name</li>
            <li>Exports carry period, tier and range on every figure</li>
            <li>Founding schools shape the peer groups before they're fixed</li>
          </ul>
        </div>
      </section>

      <div className="wrap">
        <footer>
          <span>Groundwork</span>
          <span>Carbon accounting for physical schools</span>
          <span className="sp mono" style={{ fontSize: '11.5px', letterSpacing: '.1em' }}>
            PRE-LAUNCH · FIGURES ON THIS PAGE ARE ILLUSTRATIVE
          </span>
        </footer>
      </div>
    </>
  );
};

export default Landing;
