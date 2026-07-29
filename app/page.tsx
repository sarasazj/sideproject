"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import type { GlobeMethods } from "react-globe.gl";
import gsap from "gsap";

const Globe = dynamic(() => import("react-globe.gl"), { ssr: false });
const publicBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

type SystemKey = "scada" | "weather" | "cleaning";
type PayloadKey = "relay" | "camera" | "ai";

const chapters = [
  { id: "mission", label: "Mission" },
  { id: "sudair", label: "PV Farms" },
  { id: "context", label: "Existing Monitoring Systems" },
  { id: "payload", label: "Payload" },
  { id: "operations", label: "Operations" },
  { id: "outcome", label: "Outcome" },
];

const systems: Record<SystemKey, { title: string; signal: string; gap: string }> = {
  scada: {
    title: "SCADA",
    signal: "Tracks electrical output at the inverter and string level, in real time.",
    gap: "Identifies that output has dropped, and roughly where, not whether the cause is soiling, shading, a tracker fault, or a wiring issue.",
  },
  weather: {
    title: "Weather stations",
    signal: "Records irradiance, wind speed, and temperature at a small number of fixed points.",
    gap: "A single point reading cannot represent conditions across a utility-scale site.",
  },
  cleaning: {
    title: "Cleaning robots",
    signal: "Follow a fixed cleaning schedule across all rows of the site.",
    gap: "The schedule doesn't reflect which zones are soiled enough to need it. A lightly dusted row and a heavily soiled one are cleaned on the same rotation.",
  },
};

const payloads: Record<PayloadKey, { title: string; code: string; role: string; detail: string }> = {
  relay: {
    title: "Industrial IoT relay",
    code: "01 / CONTEXT",
    role: "Receives selected plant records from the reference site through an operator-authorized, read-only ground gateway.",
    detail: "Timestamped SCADA, weather, and maintenance records, relayed via Delay-Tolerant Networking, give the orbital image operational context.",
  },
  camera: {
    title: "Multispectral camera",
    code: "02 / OBSERVE",
    role: "Captures visible and near-infrared imagery across the full site in a single pass.",
    detail: "Reveals vegetation, sand encroachment, and reflectance changes that isolated electrical readings cannot show.",
  },
  ai: {
    title: "Onboard Edge AI",
    code: "03 / PRIORITISE",
    role: "Screens image quality and focuses zones before downlink.",
    detail: "Able to screen and prioritize imagery within the given processing, power, storage, and communication constraints, aiming to reduce the imagery selected for downlink by at least 30%.",
  },
};

const cycle = [
  { title: "Observe", text: "Acquire multispectral imagery of the site during a scheduled orbital pass." },
  { title: "Fuse", text: "Combine the image with time-aligned SCADA, weather, and cleaning-robot records from the ground segment." },
  { title: "Act", text: "Flag the highest-priority zone and support dispatch of inspection or cleaning." },
  { title: "Verify", text: "Reimage the same zone on a subsequent pass to confirm the outcome." },
  { title: "Learn", text: "Carry verified outcomes into how future passes are prioritized." },
];

export default function Home() {
  const [chapter, setChapter] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [siteOpen, setSiteOpen] = useState(false);
  const [system, setSystem] = useState<SystemKey>("scada");
  const [payload, setPayload] = useState<PayloadKey>("relay");
  const [cycleStep, setCycleStep] = useState(0);
  const [globeReady, setGlobeReady] = useState(false);
  const [globeSize, setGlobeSize] = useState(800);
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const lock = useRef(false);
  const touchStart = useRef<number | null>(null);
  const satelliteImage = useRef<HTMLImageElement>(null);
  const experienceRef = useRef<HTMLElement>(null);

  const goTo = useCallback((target: number) => {
    if (lock.current || target < 0 || target >= chapters.length || target === chapter) return;
    lock.current = true;
    setDirection(target > chapter ? 1 : -1);
    setChapter(target);
    if (target !== 1) setSiteOpen(false);
    window.setTimeout(() => { lock.current = false; }, 900);
  }, [chapter]);

  const next = useCallback(() => goTo(chapter + 1), [chapter, goTo]);
  const previous = useCallback(() => goTo(chapter - 1), [chapter, goTo]);

  useEffect(() => {
    const resize = () => setGlobeSize(Math.min(window.innerWidth * 0.86, window.innerHeight * 0.92, 900));
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  useEffect(() => {
    if (!globeReady || !globeRef.current) return;
    if (chapter === 0) globeRef.current.pointOfView({ lat: 21, lng: 43, altitude: 2.25 }, 1300);
    if (chapter === 1) globeRef.current.pointOfView({ lat: 25.7688, lng: 45.5872, altitude: 0.78 }, 1500);
  }, [chapter, globeReady]);

  useEffect(() => {
    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) < 18) return;
      if (event.deltaY > 0) next();
      else previous();
    };
    window.addEventListener("wheel", onWheel, { passive: true });
    return () => window.removeEventListener("wheel", onWheel);
  }, [next, previous]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement).closest("button")) return;
      if (event.key === "ArrowDown" || event.key === "ArrowRight" || event.key === " ") next();
      if (event.key === "ArrowUp" || event.key === "ArrowLeft") previous();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [next, previous]);

  useEffect(() => {
    if (!satelliteImage.current) return;
    const tween = gsap.to(satelliteImage.current, {
      scale: chapter === 3 ? 1.09 : 1.04,
      rotation: chapter === 3 ? -1.2 : 0.8,
      duration: 1.4,
      ease: "power3.inOut",
    });
    return () => {
      tween.kill();
    };
  }, [chapter]);

  const onPointerMove = (event: React.PointerEvent<HTMLElement>) => {
    const x = event.clientX / window.innerWidth - 0.5;
    const y = event.clientY / window.innerHeight - 0.5;
    experienceRef.current?.style.setProperty("--pointer-x", `${x * 18}px`);
    experienceRef.current?.style.setProperty("--pointer-y", `${y * 18}px`);
    experienceRef.current?.style.setProperty("--spot-x", `${event.clientX}px`);
    experienceRef.current?.style.setProperty("--spot-y", `${event.clientY}px`);
  };

  const onTouchStart = (event: React.TouchEvent) => {
    touchStart.current = event.touches[0].clientY;
  };

  const onTouchEnd = (event: React.TouchEvent) => {
    if (touchStart.current === null) return;
    const distance = touchStart.current - event.changedTouches[0].clientY;
    if (Math.abs(distance) > 55) {
      if (distance > 0) next();
      else previous();
    }
    touchStart.current = null;
  };

  return (
    <main
      ref={experienceRef}
      className={`experience chapter-${chapter} ${siteOpen ? "site-is-open" : ""}`}
      data-chapter={chapters[chapter].id}
      style={{
        "--site-image": `url("${publicBasePath}/sudair-aerial.jpg")`,
        "--solar-image": `url("${publicBasePath}/solar-close.png")`,
      } as React.CSSProperties}
      onPointerMove={onPointerMove}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <header className="launch-header">
        <button type="button" className="wordmark" onClick={() => goTo(0)} aria-label="Return to mission opening">
          THUKAA
          <span>Solar intelligence mission</span>
        </button>
        <nav className="primary-nav" aria-label="Mission chapters">
          {chapters.map((item, index) => (
            <button
              type="button"
              key={item.id}
              className={chapter === index ? "is-active" : ""}
              onClick={() => goTo(index)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <span className="mission-state"><i /> Mission concept</span>
      </header>

      <aside className="mission-rail" aria-label="Mission progress">
        {chapters.map((item, index) => (
          <button
            type="button"
            key={item.id}
            className={chapter === index ? "is-active" : ""}
            onClick={() => goTo(index)}
            aria-label={`Open ${item.label}`}
          >
            <i />
            <span>{String(index + 1).padStart(2, "0")}</span>
          </button>
        ))}
      </aside>

      <OrbitalWorld
        chapter={chapter}
        siteOpen={siteOpen}
        globeSize={globeSize}
        globeRef={globeRef}
        onGlobeReady={() => setGlobeReady(true)}
        satelliteImage={satelliteImage}
      />

      <div key={`${chapter}-${siteOpen}`} className="transition-flare" aria-hidden="true" />

      <section className="chapter-stage">
        <div key={chapter} className={`chapter-content chapter-content--${direction > 0 ? "forward" : "back"}`}>
          {chapter === 0 && <Hero onBegin={() => goTo(1)} />}
          {chapter === 1 && <Site open={siteOpen} onOpen={() => setSiteOpen(true)} onClose={() => setSiteOpen(false)} />}
          {chapter === 2 && <SignalGap active={system} onSelect={setSystem} />}
          {chapter === 3 && <Payload active={payload} onSelect={setPayload} />}
          {chapter === 4 && <Operations active={cycleStep} onSelect={setCycleStep} />}
          {chapter === 5 && <Outcome onReplay={() => goTo(0)} onReviewPayload={() => goTo(3)} />}
        </div>
      </section>

      {chapter > 0 && (
        <button type="button" className="previous-control" onClick={previous} aria-label={`Back to ${chapters[chapter - 1].label}`}>
          <span>Back</span><i>{"←"}</i>
        </button>
      )}

      {chapter < chapters.length - 1 && (
        <button type="button" className="next-control" onClick={next}>
          <span>Next</span>
          <strong>{chapters[chapter + 1].label}</strong>
          <i>{"→"}</i>
        </button>
      )}
    </main>
  );
}

function OrbitalWorld({
  chapter,
  siteOpen,
  globeSize,
  globeRef,
  onGlobeReady,
  satelliteImage,
}: {
  chapter: number;
  siteOpen: boolean;
  globeSize: number;
  globeRef: React.MutableRefObject<GlobeMethods | undefined>;
  onGlobeReady: () => void;
  satelliteImage: React.RefObject<HTMLImageElement | null>;
}) {
  return (
    <div className="orbital-world" aria-hidden="true">
      <div className="pointer-light" />
      <div className="star-plane star-plane--far" />
      <div className="star-plane star-plane--near" />
      <div className="earth-limb" />
      <div className="orbit orbit--one" />
      <div className="orbit orbit--two" />

      <div className={`globe-stage ${chapter <= 1 && !siteOpen ? "is-visible" : ""}`}>
        <Globe
          ref={globeRef}
          width={globeSize}
          height={globeSize}
          backgroundColor="rgba(0,0,0,0)"
          globeImageUrl="https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
          bumpImageUrl="https://unpkg.com/three-globe/example/img/earth-topology.png"
          atmosphereColor="#66dfd4"
          atmosphereAltitude={0.13}
          pointsData={[{ lat: 25.7688, lng: 45.5872, radius: 0.12 }]}
          pointLat="lat"
          pointLng="lng"
          pointAltitude={0.015}
          pointRadius="radius"
          pointColor={() => "#ffb45e"}
          onGlobeReady={onGlobeReady}
        />
        <div className="target-reticle"><i /></div>
      </div>

      <div className="site-visual" />
      <div className="solar-visual" />

      {(chapter === 0 || chapter === 3 || chapter === 5) && (
        <div className="satellite-stage">
          <div className="satellite-crop" role="img" aria-label="One 6U CubeSat in low Earth orbit">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={satelliteImage}
              src={`${publicBasePath}/cubesat-sequence-source.jpg`}
              alt=""
              width="1280"
              height="1200"
              draggable={false}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function Hero({ onBegin }: { onBegin: () => void }) {
  return (
    <article className="hero chapter-panel">
      <p className="eyebrow">6U CubeSat / Solar asset intelligence</p>
      <h1>Integrated Intelligence for Solar Assets</h1>
      <p className="hero-lead">
        THUKAA is a 6U CubeSat mission concept for monitoring large photovoltaic farms,
        with Sudair Solar PV recommended as the reference case study. It combines an
        Industrial Internet of Things relay, a compact multispectral Earth-observation
        payload operating in a proposed sun-synchronous orbit, and onboard Edge AI.
      </p>
      <button type="button" className="primary-action" onClick={onBegin}>
        Begin mission <i>{"→"}</i>
      </button>
      <div className="hero-specs" aria-label="Mission capabilities">
        <span><b>01</b> Industrial IoT relay</span>
        <span><b>02</b> Multispectral Earth observation</span>
        <span><b>03</b> Onboard Edge AI</span>
      </div>
    </article>
  );
}

function Site({ open, onOpen, onClose }: { open: boolean; onOpen: () => void; onClose: () => void }) {
  return (
    <article className={`site-chapter chapter-panel ${open ? "is-open" : ""}`}>
      {!open ? (
        <div className="site-intro">
          <p className="eyebrow">25.7688° N / 45.5872° E</p>
          <h2>Saudi Arabia&apos;s Renewable Energy Expansion.</h2>
          <p>
            Saudi Arabia&apos;s Vision 2030 aims to generate 50% of its electricity from
            renewable sources by 2030, focusing on solar, wind, and hydrogen technologies.
            At the core of this transition is Sudair PV farm.
          </p>
          <button type="button" className="target-action" onClick={onOpen}>
            <span><i /> Enter Sudair</span>
            <b>{"↘"}</b>
          </button>
        </div>
      ) : (
        <div className="site-data">
          <button type="button" className="view-orbit" onClick={onClose}>{"←"} View from orbit</button>
          <p className="eyebrow">Sudair Solar PV Independent Power Plant</p>
          <h2>Utility scale demands location-specific decisions.</h2>
          <p>
            Sudair is a joint venture of ACWA Power, Badeel, and Saudi Aramco Power Company.
            Its scale makes panel-by-panel inspection impractical.
          </p>
          <div className="site-metrics">
            <div><strong>1.5 GW</strong><span>generation capacity</span></div>
            <div><strong>~185,000</strong><span>homes supplied</span></div>
            <div><strong>~2.9 Mt</strong><span>annual CO₂ avoided</span></div>
          </div>
          <span className="site-credit">Sudair aerial / ACWA Power and POWER Magazine</span>
        </div>
      )}
    </article>
  );
}

function SignalGap({ active, onSelect }: { active: SystemKey; onSelect: (key: SystemKey) => void }) {
  const current = systems[active];
  return (
    <article className="signal-chapter chapter-panel">
      <div className="signal-copy">
        <p className="eyebrow">The intelligence gap</p>
        <h2>SCADA, weather stations, and cleaning schedules each report part of the plant, not the whole site.</h2>
        <p>Select an existing system to see its function.</p>
      </div>
      <div className="system-interface" data-interactive>
        <div className="system-selector">
          {(Object.keys(systems) as SystemKey[]).map((key, index) => (
            <button
              type="button"
              key={key}
              className={active === key ? "is-active" : ""}
              onClick={() => onSelect(key)}
              aria-pressed={active === key}
            >
              <span>0{index + 1}</span>
              <strong>{systems[key].title}</strong>
            </button>
          ))}
        </div>
        <div className="system-readout" key={active}>
          <h3>{current.title}</h3>
          <span>Measures</span>
          <p>{current.signal}</p>
          <hr />
          <span>Doesn&apos;t resolve</span>
          <p>{current.gap}</p>
        </div>
      </div>
    </article>
  );
}

function Payload({ active, onSelect }: { active: PayloadKey; onSelect: (key: PayloadKey) => void }) {
  const current = payloads[active];
  return (
    <article className="payload-chapter chapter-panel">
      <div className="payload-heading">
        <h2>THUKAA payloads</h2>
      </div>
      <div className="payload-interface" data-interactive>
        <div className="payload-selector">
          {(Object.keys(payloads) as PayloadKey[]).map((key) => (
            <button
              type="button"
              key={key}
              className={active === key ? "is-active" : ""}
              onClick={() => onSelect(key)}
              aria-pressed={active === key}
            >
              <span>{payloads[key].code}</span>
              <strong>{payloads[key].title}</strong>
            </button>
          ))}
        </div>
        <div className="payload-readout" key={active}>
          <span>{current.code}</span>
          <h3>{current.title}</h3>
          <strong>{current.role}</strong>
          <p>{current.detail}</p>
        </div>
      </div>
    </article>
  );
}

function Operations({ active, onSelect }: { active: number; onSelect: (index: number) => void }) {
  return (
    <article className="operations-chapter chapter-panel">
      <div className="operations-copy">
        <p className="eyebrow">Operational loop</p>
        <h2>Observation is useful only when it closes the loop.</h2>
        <div className="cycle-readout" key={active}>
          <span>{String(active + 1).padStart(2, "0")} / 05</span>
          <h3>{cycle[active].title}</h3>
          <p>{cycle[active].text}</p>
        </div>
      </div>
      <div className="cycle-map" data-interactive>
        <div className="cycle-core"><span>THUKAA</span><b>Decision loop</b></div>
        {cycle.map((step, index) => (
          <button
            type="button"
            key={step.title}
            className={active === index ? "is-active" : ""}
            onClick={() => onSelect(index)}
            aria-pressed={active === index}
          >
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{step.title}</strong>
          </button>
        ))}
      </div>
    </article>
  );
}

function Outcome({ onReplay, onReviewPayload }: { onReplay: () => void; onReviewPayload: () => void }) {
  return (
    <article className="outcome-chapter chapter-panel">
      <p className="eyebrow">Mission outcome</p>
      <h2>A Connected System Built to Scale</h2>
      <p>
        A scalable IIoT integration architecture combined with specified EO monitoring and
        onboard edge AI, producing a single unified smart PV monitoring system.
      </p>
      <div className="outcome-actions">
        <button type="button" className="primary-action" onClick={onReplay}>Replay experience <i>{"↗"}</i></button>
        <button type="button" className="text-action" onClick={onReviewPayload}>Review payload {"→"}</button>
      </div>
      <div className="outcome-footer">
        <span>Mission concept / 6U CubeSat</span>
        <span>CubeSat imagery / NASA</span>
        <span>Sudair imagery / ACWA Power and POWER Magazine</span>
      </div>
    </article>
  );
}
