import { useCallback, useRef, useState } from "react";
import Navbar from "./components/Navbar.jsx";
import Hero from "./components/Hero.jsx";
import Features from "./components/Features.jsx";
import Platforms from "./components/Platforms.jsx";
import Footer from "./components/Footer.jsx";
import ProductTour, { TOUR_STEPS } from "./components/ProductTour.jsx";

export default function App() {
  const refs = useRef({});
  const [tourActive, setTourActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const startTour = useCallback(() => {
    setStepIndex(0);
    setTourActive(true);
    document.getElementById("demo")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  const endTour = useCallback(() => {
    setTourActive(false);
  }, []);

  const next = useCallback(() => {
    setStepIndex((i) => Math.min(i + 1, TOUR_STEPS.length - 1));
  }, []);

  const prev = useCallback(() => {
    setStepIndex((i) => Math.max(i - 1, 0));
  }, []);

  const finish = useCallback(() => {
    setTourActive(false);
    document.getElementById("download")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const activeStepId = tourActive ? TOUR_STEPS[stepIndex]?.id : null;

  return (
    <>
      <Navbar onTakeTour={startTour} />
      <Hero refs={refs} activeStepId={activeStepId} onTakeTour={startTour} />
      <Features />
      <Platforms />
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
