import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import '../../components/Shell.css';
import './Landing.css';

const Landing = () => {
  useEffect(() => {
    // Theme toggle now lives in <Sidebar> itself (shared across every page).

    // The sidebar's marketing links (and Login's copy of it) are now real
    // cross-page hrefs like "/#tiers" rather than same-page anchors, so a
    // click can land here as a fresh mount with a hash already in the URL.
    // The browser's native hash-scroll fires before React has rendered
    // anything, so it always misses — do it ourselves once mounted.
    if (window.location.hash) {
      document.getElementById(window.location.hash.slice(1))?.scrollIntoView();
    }

    let io: IntersectionObserver | undefined;
    const els = document.querySelectorAll('.rv');
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window) {
      io = new IntersectionObserver(
        (es) => {
          es.forEach((e, i) => {
            if (e.isIntersecting) {
              (e.target as HTMLElement).style.transitionDelay = Math.min(i * 60, 260) + 'ms';
              e.target.classList.add('in');
              io?.unobserve(e.target);
            }
          });
        },
        { rootMargin: '0px 0px -8% 0px', threshold: 0.12 }
      );
      // A jump above (an instant scrollIntoView, not a smooth scroll a user
      // drove themselves) can carry the page past sections before the
      // observer exists to see them enter — nothing ever reports them as
      // intersecting, so they'd sit invisible even after scrolling back.
      // Anything already above the fold at mount time reveals immediately
      // instead of waiting on the observer; only what's still below gets
      // the scroll-triggered animation.
      els.forEach((el) => {
        if (el.getBoundingClientRect().top < window.innerHeight) {
          el.classList.add('in');
        } else {
          io?.observe(el);
        }
      });
    } else {
      els.forEach((el) => el.classList.add('in'));
    }

    return () => {
      io?.disconnect();
    };
  }, []);

  return (
    <div className="shell">
      <Sidebar variant="marketing" />
      <main>
      <header className="hero" id="top">
        <div className="wrap">
          <div className="herogrid">
            <div>
              <div className="eyebrow">Carbon accounting for physical schools</div>
              <h1>
                Report what you <mark>actually know</mark>.
                <br />
                Estimate the rest — <em>visibly</em>.
              </h1>
              <p className="lede">
                Most tools grade a whole campus at one rigour level, so the weakest data drags everything down.
                CarbonTally lets each category sit at <b>its own data tier</b> — meter-level on energy,
                back-of-envelope on transport — and shows <b>the uncertainty that comes with that choice</b>,
                instead of hiding it behind one tidy figure.
              </p>
              <div className="herocta">
                <Link className="pill" to="/login">
                  Start a school file
                  <svg width="12" height="12" viewBox="0 0 14 14" aria-hidden="true">
                    <path d="M1 7h11M7.5 2.5 12 7l-4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
                  </svg>
                </Link>
                <a className="pill ghost" href="#method">
                  Read the method
                </a>
              </div>
              <div className="heronote" style={{ marginTop: '12px' }}>
                No procurement call. Start with one utility bill.
              </div>
            </div>

            <figure className="figcard rv">
              <svg
                viewBox="0 0 420 250"
                width="100%"
                role="img"
                aria-label="Chart showing five emission categories, each with a confidence range that narrows as the data tier improves"
              >
                <g fontFamily="Work Sans" fontSize="9.5" fill="var(--lp-ink-faint)" fontWeight="700" letterSpacing=".5">
                  <text x="0" y="12">TCO₂E</text>
                  <text x="382" y="12">TIER</text>
                </g>
                <line x1="0" y1="214" x2="420" y2="214" stroke="var(--lp-rule)" />
                <g stroke="var(--lp-rule)" strokeWidth="1" strokeDasharray="2 4">
                  <line x1="98" y1="24" x2="98" y2="214" />
                  <line x1="182" y1="24" x2="182" y2="214" />
                  <line x1="266" y1="24" x2="266" y2="214" />
                  <line x1="350" y1="24" x2="350" y2="214" />
                </g>
                <g fontFamily="Work Sans" fontSize="11.5" fontWeight="700" fill="var(--lp-ink)">
                  <rect x="0" y="35" width="9" height="9" rx="2" fill="var(--lp-amber)" />
                  <text x="15" y="43">Energy</text>
                  <rect x="98" y="34" width="60" height="12" rx="2" fill="var(--lp-amber)" />
                  <rect x="124" y="31" width="3" height="18" fill="var(--lp-ink)" />
                  <text x="382" y="44" fontSize="9.5" fill="var(--lp-amber)">T3</text>

                  <rect x="0" y="75" width="9" height="9" rx="2" fill="var(--lp-sky)" />
                  <text x="15" y="83">Water</text>
                  <rect x="116" y="74" width="88" height="12" rx="2" fill="var(--lp-sky)" />
                  <rect x="156" y="71" width="3" height="18" fill="var(--lp-ink)" />
                  <text x="382" y="84" fontSize="9.5" fill="var(--lp-sky)">T2</text>

                  <rect x="0" y="115" width="9" height="9" rx="2" fill="var(--lp-coral)" />
                  <text x="15" y="123">Transport</text>
                  <rect x="120" y="114" width="216" height="12" rx="2" fill="var(--lp-coral)" opacity=".25" />
                  <rect x="120" y="114" width="216" height="12" rx="2" fill="none" stroke="var(--lp-coral)" strokeWidth="1" strokeDasharray="3 3" />
                  <rect x="220" y="111" width="3" height="18" fill="var(--lp-ink)" />
                  <text x="382" y="124" fontSize="9.5" fill="var(--lp-coral)">T1</text>

                  <rect x="0" y="155" width="9" height="9" rx="2" fill="var(--lp-violet)" />
                  <text x="15" y="163">Digital</text>
                  <rect x="94" y="154" width="110" height="12" rx="2" fill="var(--lp-violet)" />
                  <rect x="140" y="151" width="3" height="18" fill="var(--lp-ink)" />
                  <text x="382" y="164" fontSize="9.5" fill="var(--lp-violet)">T2</text>

                  <rect x="0" y="195" width="9" height="9" rx="2" fill="var(--lp-moss)" />
                  <text x="15" y="203">Waste</text>
                  <rect x="102" y="194" width="180" height="12" rx="2" fill="var(--lp-moss)" opacity=".25" />
                  <rect x="102" y="194" width="180" height="12" rx="2" fill="none" stroke="var(--lp-moss)" strokeWidth="1" strokeDasharray="3 3" />
                  <rect x="174" y="191" width="3" height="18" fill="var(--lp-ink)" />
                  <text x="382" y="204" fontSize="9.5" fill="var(--lp-moss)">T1</text>
                </g>
                <g fontFamily="Work Sans" fontSize="9" fill="var(--lp-ink-faint)">
                  <text x="92" y="228">40</text>
                  <text x="176" y="228">80</text>
                  <text x="256" y="228">120</text>
                  <text x="340" y="228">160</text>
                </g>
                <g fontFamily="Work Sans" fontSize="9" fill="var(--lp-ink-faint)">
                  <rect x="0" y="240" width="12" height="8" rx="2" fill="var(--lp-ink)" opacity=".7" />
                  <text x="17" y="247">MEASURED</text>
                  <rect x="98" y="240" width="12" height="8" rx="2" fill="var(--lp-ink)" opacity=".2" stroke="var(--lp-ink)" strokeWidth=".6" strokeDasharray="2 2" />
                  <text x="115" y="247">MODELLED (TIER 1)</text>
                </g>
              </svg>
              <figcaption className="figcap">
                Illustrative. Each bar is a simulated range, not a point — the dashed bars are still on Tier 1
                inputs, and look uncertain because they are.
              </figcaption>
            </figure>
          </div>

          <div className="stats3">
            <div className="stat3 rv">
              <div className="sn">5</div>
              <span className="st">Categories — energy, water, transport, digital, waste. Turn on only what you can answer.</span>
            </div>
            <div className="stat3 rv">
              <div className="sn">
                3<small>× per category</small>
              </div>
              <span className="st">Tiers of data quality, set independently per category.</span>
            </div>
            <div className="stat3 rv">
              <div className="sn">
                0<small>schools so far</small>
              </div>
              <span className="st">Pre-launch. No peer cohort yet, so benchmarking stays off until there honestly is one.</span>
            </div>
          </div>
        </div>
      </header>

      <section className="sec" id="tiers">
        <div className="wrap">
          <div className="sec-head rv">
            <div className="eyebrow">Breadth × depth</div>
            <h2>One grade for the whole building is the wrong shape for a school.</h2>
            <p>
              Twelve months of meter data and a transport survey that's never once been run shouldn't average into
              the same score. So here, they don't.
            </p>
          </div>

          <div className="compare">
            <div className="ccard bad rv">
              <div className="cicon">
                <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" /></svg>
              </div>
              <div className="ctag">The usual way</div>
              <h3>One rigour setting for everything</h3>
              <p>
                "Simple" throws away your good energy data. "Comprehensive" blocks you on the first question no
                school's ever answered. Either way: one number, no stated error.
              </p>
            </div>
            <div className="ccard good rv">
              <div className="cicon">
                <svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
              <div className="ctag">The CarbonTally way</div>
              <h3>A tier per category, any week</h3>
              <p>
                Bills in today, energy jumps to Tier 2. Survey in March, transport moves up — nothing else touched.
                Every badge stays visible, and its range matches it.
              </p>
            </div>
          </div>

          <div className="tgrid">
            <div className="tcard hero-card rv">
              <div className="thead">
                <div className="ticon" style={{ background: 'var(--lp-amber)' }}>
                  <svg viewBox="0 0 24 24"><path d="M13 2 3 14h6l-1 8 10-12h-6l1-8Z" /></svg>
                </div>
                <div>
                  <div className="tname">Energy</div>
                  <span className="tstatus" style={{ background: 'var(--lp-amber)' }}>Live first</span>
                </div>
              </div>
              <div className="ttrack">
                <div className="tseg"><small>Tier 1</small>Floor area + roll</div>
                <div className="tseg"><small>Tier 2</small>Annual bill totals</div>
                <div className="tseg"><small>Tier 3</small>Monthly / multi-meter</div>
              </div>
            </div>

            <div className="fourgrid">
              <div className="tcard rv">
                <div className="thead">
                  <div className="ticon" style={{ background: 'var(--lp-sky)' }}>
                    <svg viewBox="0 0 24 24"><path d="M12 2C12 2 5 12 5 16.5A7 7 0 0 0 19 16.5C19 12 12 2 12 2Z" /></svg>
                  </div>
                  <div>
                    <div className="tname">Water</div>
                    <span className="tstatus" style={{ background: 'var(--lp-sky)' }}>Next</span>
                  </div>
                </div>
                <div className="ttrack">
                  <div className="tseg"><small>T1</small>Litres per pupil</div>
                  <div className="tseg"><small>T2</small>Annual supply bill</div>
                  <div className="tseg"><small>T3</small>Sub-metered</div>
                </div>
              </div>
              <div className="tcard rv">
                <div className="thead">
                  <div className="ticon" style={{ background: 'var(--lp-coral)' }}>
                    <svg viewBox="0 0 24 24">
                      <rect x="3" y="6" width="18" height="11" rx="2" />
                      <path d="M6 9h3M10.5 9h3M15 9h3M7 20l-1-3M17 20l1-3" stroke="var(--lp-coral)" strokeWidth="1.4" />
                      <circle cx="7.5" cy="19" r="1.6" fill="var(--lp-coral)" />
                      <circle cx="16.5" cy="19" r="1.6" fill="var(--lp-coral)" />
                    </svg>
                  </div>
                  <div>
                    <div className="tname">Transportation</div>
                    <span className="tstatus" style={{ background: 'var(--lp-coral)' }}>Novel ground</span>
                  </div>
                </div>
                <div className="ttrack">
                  <div className="tseg"><small>T1</small>Regional proxy</div>
                  <div className="tseg"><small>T2</small>Mode-share survey</div>
                  <div className="tseg"><small>T3</small>Termly + telemetry</div>
                </div>
              </div>
              <div className="tcard rv">
                <div className="thead">
                  <div className="ticon" style={{ background: 'var(--lp-violet)' }}>
                    <svg viewBox="0 0 24 24">
                      <rect x="3" y="4" width="18" height="12" rx="1.5" />
                      <path d="M9 19h6M12 16v3" stroke="var(--lp-violet)" strokeWidth="1.4" />
                    </svg>
                  </div>
                  <div>
                    <div className="tname">Digital</div>
                    <span className="tstatus" style={{ background: 'var(--lp-violet)' }}>Engine exists</span>
                  </div>
                </div>
                <div className="ttrack">
                  <div className="tseg"><small>T1</small>Device count</div>
                  <div className="tseg"><small>T2</small>Platform exports</div>
                  <div className="tseg"><small>T3</small>Per-cohort usage</div>
                </div>
              </div>
              <div className="tcard rv">
                <div className="thead">
                  <div className="ticon" style={{ background: 'var(--lp-moss)' }}>
                    <svg viewBox="0 0 24 24">
                      <path d="M6 6h12M9 6l.6-2h4.8l.6 2M7 6l1 14a1.5 1.5 0 0 0 1.5 1.4h5A1.5 1.5 0 0 0 16 20l1-14" stroke="#fff" strokeWidth="1.4" fill="none" />
                      <path d="M10 10v7M14 10v7" stroke="#fff" strokeWidth="1.4" />
                    </svg>
                  </div>
                  <div>
                    <div className="tname">Waste &amp; food</div>
                    <span className="tstatus" style={{ background: 'var(--lp-moss)' }}>Later</span>
                  </div>
                </div>
                <div className="ttrack">
                  <div className="tseg"><small>T1</small>Covers served</div>
                  <div className="tseg"><small>T2</small>Contractor tonnage</div>
                  <div className="tseg"><small>T3</small>Audited streams</div>
                </div>
              </div>
            </div>
          </div>
          <p className="footnote">
            Energy is what's being built first — its track is solid. The rest are designed, not shipped, so their
            tracks stay dashed; the app says so plainly instead of a greyed-out tab that implies otherwise.
          </p>
        </div>
      </section>

      <section className="sec" id="dashboard">
        <div className="wrap">
          <div className="sec-head rv">
            <div className="eyebrow">The number, and its edges</div>
            <h2>Every figure arrives as a range, because every input is one.</h2>
            <p>
              Emission factors are published as intervals, not constants — CarbonTally simulates across them
              thousands of times and reports the spread. Tier 1 makes a wide band automatically; Tier 3 makes a
              narrow one. <i>The width is the confidence score.</i>
            </p>
          </div>

          <div className="dashcard rv">
            <div className="dashtop">
              <span className="dots"><i></i><i></i><i></i></span>
              Northfield Academy · 01 Sep 2025 → 31 Aug 2026 · 12 months
            </div>
            <div className="dashbody">
              <div className="dashleft">
                <div className="dashtotal">
                  <b>1,184</b>
                  <span>tCO₂e · 90% range 1,046–1,392 · ±14.6%</span>
                </div>
                <div className="dashsub">Sample school. Figures are illustrative.</div>

                <div className="drow">
                  <div className="dn"><i style={{ background: 'var(--lp-amber)' }}></i>Energy</div>
                  <div className="bartrack"><div className="barfill" style={{ left: '17%', width: '15%', background: 'var(--lp-amber)' }}></div></div>
                  <div className="dv">612 ±4%</div>
                </div>
                <div className="drow">
                  <div className="dn"><i style={{ background: 'var(--lp-coral)' }}></i>Transport</div>
                  <div className="bartrack"><div className="barfill" style={{ left: '15%', width: '59%', background: 'var(--lp-coral)', opacity: 0.55 }}></div></div>
                  <div className="dv">318 ±41%</div>
                </div>
                <div className="drow">
                  <div className="dn"><i style={{ background: 'var(--lp-sky)' }}></i>Water</div>
                  <div className="bartrack"><div className="barfill" style={{ left: '8%', width: '19%', background: 'var(--lp-sky)' }}></div></div>
                  <div className="dv">141 ±11%</div>
                </div>
                <div className="drow">
                  <div className="dn"><i style={{ background: 'var(--lp-violet)' }}></i>Digital</div>
                  <div className="bartrack"><div className="barfill" style={{ left: '4%', width: '17%', background: 'var(--lp-violet)' }}></div></div>
                  <div className="dv">83 ±13%</div>
                </div>
                <div className="drow">
                  <div className="dn"><i style={{ background: 'var(--lp-moss)' }}></i>Waste</div>
                  <div className="bartrack"><div className="barfill" style={{ left: '2%', width: '24%', background: 'var(--lp-moss)', opacity: 0.55 }}></div></div>
                  <div className="dv">30 ±58%</div>
                </div>
              </div>

              <div className="dashright">
                <div>
                  <h4>Where the uncertainty actually lives</h4>
                  <p>
                    Transport is 27% of this school's footprint and carries almost all of its error. One
                    mode-share survey would cut the whole-school range by roughly a third — more than another year
                    of energy meter data would.
                  </p>
                </div>
                <div className="lockcard">
                  <svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
                  <div>
                    <div className="lt">Peer standing — locked</div>
                    <p>
                      Needs a real cohort of comparable schools — same setting, climate region, data tier. You'll
                      see a bar here once one exists, not before.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="sec" id="method">
        <div className="wrap">
          <div className="sec-head rv">
            <div className="eyebrow">How a number gets made</div>
            <h2>Four steps, each one auditable a year later.</h2>
            <p>Nothing is derived from a source we can't point at, and nothing enters your file without a human agreeing to it first.</p>
          </div>

          <div className="steps">
            <div className="step rv">
              <div className="sicon">
                <svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="2" /><line x1="4" y1="10" x2="20" y2="10" /><line x1="8" y1="3" x2="8" y2="7" /><line x1="16" y1="3" x2="16" y2="7" /></svg>
              </div>
              <div className="snum">STEP 01</div>
              <h3>Give the period, not the year</h3>
              <p>Every row carries a real start and end date. A five-week snapshot is labelled a spot check — never annualised by naive multiplication.</p>
              <div className="ssrc">Partial years extend using a seasonal shape from public degree-day data, marked "modelled."</div>
            </div>
            <div className="step rv">
              <div className="sicon">
                <svg viewBox="0 0 24 24"><path d="M12 16V4M7 9l5-5 5 5" /><rect x="4" y="17" width="16" height="3" rx="1" fill="var(--lp-brand)" stroke="none" /></svg>
              </div>
              <div className="snum">STEP 02</div>
              <h3>Get the data in three ways</h3>
              <p>Photograph a bill, import a spreadsheet, or type one meter read at a time. Extracted fields always land in a review screen first.</p>
              <div className="ssrc">A consumption figure next to a demand charge raises a written warning, not a quiet lower score.</div>
            </div>
            <div className="step rv">
              <div className="sicon">
                <svg viewBox="0 0 24 24"><path d="M4 8h13l-3-3M20 16H7l3 3" /></svg>
              </div>
              <div className="snum">STEP 03</div>
              <h3>Convert once, at the door</h3>
              <p>Enter therms, gallons, miles — whatever your invoices use. Everything normalises to one internal unit on the way in.</p>
              <div className="ssrc">Your local units are what's shown back on every screen and every export.</div>
            </div>
            <div className="step rv">
              <div className="sicon">
                <svg viewBox="0 0 24 24" fill="var(--lp-brand)" stroke="none">
                  <rect x="4" y="4" width="16" height="16" rx="4" fill="none" stroke="var(--lp-brand)" strokeWidth="1.7" />
                  <circle cx="8.5" cy="8.5" r="1.3" /><circle cx="15.5" cy="8.5" r="1.3" /><circle cx="12" cy="12" r="1.3" />
                  <circle cx="8.5" cy="15.5" r="1.3" /><circle cx="15.5" cy="15.5" r="1.3" />
                </svg>
              </div>
              <div className="snum">STEP 04</div>
              <h3>Simulate, then report the spread</h3>
              <p>Each factor is sampled across its published interval thousands of times — a central figure plus a stated range, the shape a consultancy's reviewer would accept.</p>
              <div className="ssrc">Factors: a multi-property peer study, a national building-energy survey, an adapted commuting methodology, a peer-reviewed food-emissions dataset.</div>
            </div>
          </div>
        </div>
      </section>

      <section className="sec" id="benchmark">
        <div className="wrap">
          <div className="bmgrid">
            <div className="bmtext rv">
              <blockquote>
                "Roughly a third lower than similar schools" is a claim. <em>1,046 to 1,392 tonnes, transport modelled</em> is a disclosure.
              </blockquote>
              <p>
                CarbonTally is built for the moment after the report is published — the parent email, the board
                follow-up, the local paper. A stated range holds up under that. A confident single figure with
                undocumented assumptions doesn't, and in some jurisdictions that's a liability, not just an
                embarrassment.
              </p>
              <div className="legalbox">
                Environmental claims made to the public are regulated in several jurisdictions, including US
                federal guidance on environmental marketing and state consumer-protection statutes. Overstated
                precision is a named failure mode. Every export carries its method, period, tier and range — what
                a regulator or journalist would ask for.
              </div>
            </div>
            <div className="rv">
              <div className="eyebrow" style={{ marginBottom: '14px' }}>The software refuses, on your behalf</div>
              <div className="refuse">
                <div className="rline">
                  <span className="ric"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" /></svg></span>
                  Promote a category to a higher tier because you'd like it to be there
                </div>
                <div className="rline">
                  <span className="ric"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" /></svg></span>
                  Fill a data gap with an unlabelled assumption
                </div>
                <div className="rline">
                  <span className="ric"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" /></svg></span>
                  Show a percentile against a peer group that doesn't exist yet
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="sec" id="cta">
        <div className="wrap">
          <div className="ctacard rv">
            <div className="eyebrow">Pre-launch · Founding schools</div>
            <h2>
              Bring one electricity bill.
              <br />
              That's a real starting point.
            </h2>
            <p className="lede2">
              Energy at Tier 2 in a single sitting is enough for a defensible first number with an honest range on
              it. Everything else can stay at Tier 1 until you have a term for it.
            </p>
            <div className="herocta">
              <Link className="pill" to="/login">
                Start a school file
                <svg width="12" height="12" viewBox="0 0 14 14" aria-hidden="true">
                  <path d="M1 7h11M7.5 2.5 12 7l-4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
                </svg>
              </Link>
              <a className="pill ghost" href="#method">
                Send the method to your business office
              </a>
            </div>
            <ul className="checklist">
              <li>
                <svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                One school, one file — not a district rollout to start
              </li>
              <li>
                <svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                Your submitted data is yours; nothing publishes without you
              </li>
              <li>
                <svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                Student surveys collect mode and postcode only — never a name
              </li>
              <li>
                <svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                Exports carry period, tier and range on every figure
              </li>
              <li>
                <svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                Founding schools help shape the peer groups before they're fixed
              </li>
            </ul>
          </div>
        </div>
      </section>

      <div className="wrap">
        <footer>
          <span className="fmark">CarbonTally</span>
          <span>Carbon accounting for physical schools</span>
          <span className="sp" style={{ fontSize: '11px', letterSpacing: '.08em', fontWeight: 700 }}>
            PRE-LAUNCH · FIGURES ON THIS PAGE ARE ILLUSTRATIVE
          </span>
        </footer>
      </div>
      </main>
    </div>
  );
};

export default Landing;
