import { useCallback, useRef, useState } from "react";
import Nav from "./components/Nav.jsx";
import Hero from "./components/Hero.jsx";
import LaunchVideo from "./components/LaunchVideo.jsx";
import Story from "./components/Story.jsx";
import DemoSection from "./components/DemoSection.jsx";
import Features from "./components/Features.jsx";
import Compare from "./components/Compare.jsx";
import Privacy from "./components/Privacy.jsx";
import Platforms from "./components/Platforms.jsx";
import FAQ from "./components/FAQ.jsx";
import Footer from "./components/Footer.jsx";
import ProductTour, { TOUR_STEPS } from "./components/ProductTour.jsx";
import { useLatestRelease, RELEASES_URL } from "./hooks/useLatestRelease.js";
import { detectOS } from "./hooks/useOS.js";
import { useReveal } from "./hooks/useReveal.js";

export default function App() {
  const refs = useRef({});
  const [tourActive, setTourActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  // One GitHub API call for the whole page; the hero and the download
  // section both read from it.
  const release = useLatestRelease();
  const os = detectOS();
  const primaryAsset = release.assets[os];
  const primaryHref = primaryAsset ? primaryAsset.browser_download_url : "#download";
  useReveal();

  const startTour = useCallback(() => {
    setStepIndex(0);
    setTourActive(true);
    document.getElementById("demo")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);
  const endTour = useCallback(() => setTourActive(false), []);
  const next = useCallback(() => setStepIndex((i) => Math.min(i + 1, TOUR_STEPS.length - 1)), []);
  const prev = useCallback(() => setStepIndex((i) => Math.max(i - 1, 0)), []);
  const finish = useCallback(() => {
    setTourActive(false);
    document.getElementById("download")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const activeStepId = tourActive ? TOUR_STEPS[stepIndex]?.id : null;

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Nav onTakeTour={startTour} downloadHref="#download" />
      <main id="main">
        <Hero
          os={os}
          primaryHref={primaryAsset ? primaryHref : RELEASES_URL}
          version={release.release?.tag_name}
          onTakeTour={startTour}
        />
        <LaunchVideo />
        <Story />
        <DemoSection refs={refs} activeStepId={activeStepId} onTakeTour={startTour} />
        <Features />
        <Compare />
        <Privacy />
        <Platforms os={os} release={release} />
        <FAQ />
      </main>
      <Footer />
      <ProductTour
        refs={refs}
        active={tourActive}
        stepIndex={stepIndex}
        onNext={next}
        onPrev={prev}
        onSkip={endTour}
        onFinish={finish}
      />
    </>
  );
}
